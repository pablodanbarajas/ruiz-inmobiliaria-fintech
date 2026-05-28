import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Recibe eventos de Quentli (INVOICE_PAID, INVOICE_PAID_OTHER)
// y registra el pago automáticamente en la tabla `pago` de Supabase.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { eventType, data } = body

  // Solo procesar eventos de pago
  if (eventType !== 'INVOICE_PAID' && eventType !== 'INVOICE_PAID_OTHER') {
    return new Response(JSON.stringify({ ok: true, skipped: true, eventType }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Extraer datos del evento
  const clienteid = parseInt(data?.customer?.username ?? '', 10)
  const amountCentavos: number = data?.amount ?? 0
  const montopagado = amountCentavos / 100
  const invoiceId: string = data?.invoiceId ?? ''
  const paymentType: string = data?.payment?.type ?? 'OTHER'

  if (!clienteid || isNaN(clienteid) || montopagado <= 0) {
    return new Response(
      JSON.stringify({ error: 'Datos insuficientes: se requiere customer.username y amount' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 1. Buscar venta activa del cliente que coincida con el monto
  const { data: ventas, error: ventaError } = await supabase
    .from('venta')
    .select('ventaid, mensualidad')
    .eq('clienteid', clienteid)
    .eq('estatus', 'A')

  if (ventaError || !ventas || ventas.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No se encontró venta activa', clienteid }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Priorizar la venta cuya mensualidad coincide con el monto pagado
  const venta =
    ventas.find((v) => Math.abs((v.mensualidad ?? 0) - montopagado) < 1) ?? ventas[0]

  // 2. Obtener corridas financieras pendientes de pago (nopago > 0)
  const { data: corridas, error: corridaError } = await supabase
    .from('corridafinanciera')
    .select('corridafinancieraid, nopago, fecha, mensualidad')
    .eq('ventaid', venta.ventaid)
    .gt('nopago', 0)
    .order('nopago', { ascending: true })

  if (corridaError || !corridas) {
    return new Response(
      JSON.stringify({ error: 'Error al obtener corrida financiera', ventaid: venta.ventaid }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Obtener IDs de corridas que ya tienen pago registrado
  const corridaIds = corridas.map((c) => c.corridafinancieraid)
  const { data: pagosExistentes } = await supabase
    .from('pagos')
    .select('corridafinancieraid')
    .in('corridafinancieraid', corridaIds)
    .eq('estatus', 'P')

  const corridasConPago = new Set((pagosExistentes ?? []).map((p) => p.corridafinancieraid))

  // 4. Encontrar la primera mensualidad sin pago registrado
  const unpaid = corridas.find((c) => !corridasConPago.has(c.corridafinancieraid))

  if (!unpaid) {
    return new Response(
      JSON.stringify({ ok: true, message: 'Todos los pagos ya están registrados', ventaid: venta.ventaid }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 4. Insertar registro en tabla pago
  // formapago: 4=Tarjeta, 2=Transferencia, 1=Efectivo
  const formapago = paymentType === 'CARD' ? 4 : paymentType === 'TRANSFER' ? 2 : 1

  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      corridafinancieraid: unpaid.corridafinancieraid,
      fechapago: new Date().toISOString().split('T')[0],
      montopagado,
      formapago,
      estatus: 'P',
      referencia: invoiceId,
      comentario: `Pago registrado automáticamente desde Quentli (${eventType})`,
    })
    .select()
    .single()

  if (pagoError) {
    return new Response(
      JSON.stringify({ error: `Error al insertar pago: ${pagoError.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      ok: true,
      pagoid: pago.pagoid,
      nopago: unpaid.nopago,
      ventaid: venta.ventaid,
      montopagado,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
