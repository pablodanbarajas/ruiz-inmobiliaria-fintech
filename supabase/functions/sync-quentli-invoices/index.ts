import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUENTLI_API = Deno.env.get('QUENTLI_API_URL') ?? 'https://api.demo.quentli.com'

/**
 * Cron diario que sincroniza invoices de Quentli con el estado actual de Supabase.
 * Dos acciones:
 *   1. CREAR invoices para corridas que vencen en los próximos DAYS_AHEAD días.
 *   2. ACTUALIZAR (PATCH) invoices existentes de corridas vencidas con el recargo acumulado actual.
 *
 * Llamar vía pg_cron:
 *   SELECT cron.schedule('sync-quentli-invoices', '0 8 * * *',
 *     $$SELECT net.http_post(url := '...', headers := '...', body := '{}')$$);
 */

const DAYS_AHEAD = 7 // crear invoices N días antes del vencimiento

Deno.serve(async (req: Request) => {
  // Permitir llamada con Authorization del cron (service key) o desde admin
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  // Validar: acepta service role key o el cron secret configurado
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (token !== serviceKey && token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceKey,
  )

  const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
  const qHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  const today = new Date()
  const futureLimit = new Date(today)
  futureLimit.setDate(futureLimit.getDate() + DAYS_AHEAD)
  const todayStr = today.toISOString().split('T')[0]
  const futureLimitStr = futureLimit.toISOString().split('T')[0]

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 }

  // Si está definido, solo procesa ese desarrollo (útil para pruebas)
  const filterDesarrolloId = Deno.env.get('CRON_FILTER_DESARROLLOID') ?? ''

  // ── 1. Corridas próximas sin invoice: crear ──────────────────────────────
  const upcomingQuery = supabase
    .from('corridafinanciera')
    .select(`
      corridafinancieraid, ventaid, fecha, mensualidad, nopago,
      venta:ventaid (clienteid, dias_tolerancia, quentli_customer_id, estatus, lote:loteid(loteid, desarrolloid))
    `)
    .gte('fecha', todayStr)
    .lte('fecha', futureLimitStr)
    .gt('nopago', 0)
    .is('quentli_invoice_id', null)
  const { data: upcomingRaw } = await upcomingQuery
  const upcoming = (upcomingRaw ?? []).filter((c: any) => {
    const v = Array.isArray(c.venta) ? c.venta[0] : c.venta
    const l = Array.isArray(v?.lote) ? v?.lote[0] : v?.lote
    // Solo ventas activas; excluir canceladas
    if (!v || v.estatus === 'C') return false
    if (filterDesarrolloId && String(l?.desarrolloid) !== filterDesarrolloId) return false
    return true
  })

  for (const corrida of (upcoming ?? [])) {
    try {
      const venta = Array.isArray(corrida.venta) ? corrida.venta[0] : corrida.venta
      if (!venta?.clienteid) { results.skipped++; continue }

      // Verificar que no tenga pago ya registrado
      const { count } = await supabase
        .from('pagos')
        .select('pagoid', { count: 'exact', head: true })
        .eq('corridafinancieraid', corrida.corridafinancieraid)
        .in('estatus', ['P', 'R'])
      if ((count ?? 0) > 0) { results.skipped++; continue }

      // Resolver customer ID en Quentli
      let customerId: string | null = venta.quentli_customer_id ?? null
      if (!customerId) {
        const r = await fetch(
          `${QUENTLI_API}/v1/customers?filter[username][equals]=${encodeURIComponent(String(venta.clienteid))}`,
          { headers: qHeaders },
        )
        if (r.ok) {
          const list = await r.json()
          customerId = list[0]?.id ?? list.data?.[0]?.id ?? null
        }
        if (!customerId) { results.skipped++; continue }
      }

      // Cargos extra por lote con filtro de fechas (igual que la vista del admin)
      const loteid = (Array.isArray(venta.lote) ? venta.lote[0] : venta.lote)?.loteid ?? null
      let cargoExtra = 0
      if (loteid) {
        const { data: cargos } = await supabase
          .from('cargos_extra')
          .select('monto')
          .eq('loteid', loteid)
          .neq('estatus', 'X')
          .lte('fecha', corrida.fecha)
          .or(`fecha_fin.is.null,fecha_fin.gte.${corrida.fecha}`)
        cargoExtra = (cargos ?? []).reduce((s: number, c: any) => s + Number(c.monto), 0)
      }

      const totalCentavos = Math.round((Number(corrida.mensualidad) + cargoExtra) * 100)
      const dueDate = `${corrida.fecha}T06:00:00.000Z`

      const invoiceRes = await fetch(`${QUENTLI_API}/v1/invoices`, {
        method: 'POST',
        headers: qHeaders,
        body: JSON.stringify({
          input: {
            customerId,
            dueDate,
            expireDate: dueDate, // expira en la fecha de vencimiento — después el portal maneja recargo
            collectionMethod: 'SEND_REMINDER',
            allowOfftimePayment: true,
            items: [{
              concept: {
                displayName: `Mensualidad · Venta #${corrida.ventaid} (pago ${corrida.nopago})`,
                amount: totalCentavos,
                currency: 'MXN',
              },
              quantity: 1,
            }],
            metadata: [
              { key: 'corridafinancieraid', value: String(corrida.corridafinancieraid) },
              { key: 'ventaid', value: String(corrida.ventaid) },
              { key: 'clienteid', value: String(venta.clienteid) },
            ],
          },
        }),
      })

      if (!invoiceRes.ok) {
        console.error(`Error creando invoice para corrida ${corrida.corridafinancieraid}:`, await invoiceRes.text())
        results.errors++
        continue
      }

      const invData = await invoiceRes.json()
      const invoiceId = invData.invoice?.id ?? ''
      if (invoiceId) {
        await supabase
          .from('corridafinanciera')
          .update({ quentli_invoice_id: invoiceId })
          .eq('corridafinancieraid', corrida.corridafinancieraid)
        results.created++
      }
    } catch (e) {
      console.error(`Error en corrida ${corrida.corridafinancieraid}:`, e)
      results.errors++
    }
  }

  // ── 2. Corridas vencidas con invoice: actualizar monto con recargo actual ──
  const overdueQuery = supabase
    .from('corridafinanciera')
    .select(`
      corridafinancieraid, ventaid, fecha, mensualidad, nopago, quentli_invoice_id,
      venta:ventaid (clienteid, dias_tolerancia, estatus, lote:loteid(loteid, desarrolloid))
    `)
    .lt('fecha', todayStr)
    .gt('nopago', 0)
    .not('quentli_invoice_id', 'is', null)
  const { data: overdueRaw } = await overdueQuery
  const overdue = (overdueRaw ?? []).filter((c: any) => {
    const v = Array.isArray(c.venta) ? c.venta[0] : c.venta
    const l = Array.isArray(v?.lote) ? v?.lote[0] : v?.lote
    if (!v || v.estatus === 'C') return false
    if (filterDesarrolloId && String(l?.desarrolloid) !== filterDesarrolloId) return false
    return true
  })

  for (const corrida of (overdue ?? [])) {
    try {
      // Saltar si ya tiene pago registrado
      const { count } = await supabase
        .from('pagos')
        .select('pagoid', { count: 'exact', head: true })
        .eq('corridafinancieraid', corrida.corridafinancieraid)
        .in('estatus', ['P', 'R'])
      if ((count ?? 0) > 0) { results.skipped++; continue }

      const venta = Array.isArray(corrida.venta) ? corrida.venta[0] : corrida.venta
      const diasTolerancia = venta?.dias_tolerancia ?? 0

      // Calcular recargo: $150 por cada período de 7 días
      const fechaVenc = new Date(corrida.fecha + 'T12:00:00')
      const diasAtraso = Math.floor((today.getTime() - fechaVenc.getTime()) / 86400000) - diasTolerancia
      const recargo = diasAtraso > 0 ? Math.ceil(diasAtraso / 7) * 150 : 0

      if (recargo === 0) { results.skipped++; continue }

      // Cargos extra por lote con filtro de fechas (igual que la vista del admin)
      const loteid = (Array.isArray(venta?.lote) ? venta?.lote[0] : venta?.lote)?.loteid ?? null
      let cargoExtra = 0
      if (loteid) {
        const { data: cargos } = await supabase
          .from('cargos_extra')
          .select('monto')
          .eq('loteid', loteid)
          .neq('estatus', 'X')
          .lte('fecha', corrida.fecha)
          .or(`fecha_fin.is.null,fecha_fin.gte.${corrida.fecha}`)
        cargoExtra = (cargos ?? []).reduce((s: number, c: any) => s + Number(c.monto), 0)
      }

      const totalCentavos = Math.round((Number(corrida.mensualidad) + cargoExtra + recargo) * 100)

      const patchRes = await fetch(`${QUENTLI_API}/v1/invoices/${corrida.quentli_invoice_id}`, {
        method: 'PATCH',
        headers: qHeaders,
        body: JSON.stringify({
          input: {
            data: {
              items: [{
                concept: {
                  displayName: `Mensualidad · Venta #${corrida.ventaid} (pago ${corrida.nopago})`,
                  amount: totalCentavos,
                  currency: 'MXN',
                },
                quantity: 1,
              }],
            },
          },
        }),
      })

      if (patchRes.ok) {
        results.updated++
      } else {
        const errText = await patchRes.text()
        // Limpiar siempre el ID para que el siguiente ciclo recree el invoice
        await supabase
          .from('corridafinanciera')
          .update({ quentli_invoice_id: null })
          .eq('corridafinancieraid', corrida.corridafinancieraid)
        console.error(`Error PATCH invoice ${corrida.quentli_invoice_id} (${patchRes.status}), ID limpiado: ${errText}`)
        results.errors++
      }
    } catch (e) {
      console.error(`Error actualizando corrida ${corrida.corridafinancieraid}:`, e)
      results.errors++
    }
  }

  console.log('sync-quentli-invoices completado:', results)
  return new Response(JSON.stringify({ ok: true, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
