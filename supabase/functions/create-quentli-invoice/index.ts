import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = Deno.env.get('QUENTLI_API_URL') ?? 'https://api.demo.quentli.com'

/**
 * Crea (o reutiliza) un invoice de Quentli para una corrida financiera específica.
 *
 * A diferencia de create-payment-link (que usa payment-sessions efímeras), este
 * endpoint crea un invoice persistente en Quentli, lo que habilita:
 *   - Recordatorios automáticos por WhatsApp / email al cliente
 *   - Seguimiento del adeudo en el dashboard de Quentli
 *   - Políticas de recargos por mora (si se configura QUENTLI_SURCHARGE_MODIFIER_ID)
 *   - Métricas de cobranza
 *
 * Flujo:
 *   1. Valida JWT del cliente portal.
 *   2. Lee corridafinanciera de vista_pagos_cliente (RLS garantiza propiedad).
 *   3. Resuelve el quentli_customer_id del cliente (desde venta o buscando en Quentli).
 *   4. Si ya existe quentli_invoice_id en la corrida → devuelve su payment link.
 *   5. Si no → crea invoice en Quentli, guarda el ID y devuelve el link.
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar que el token es válido
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { corridafinancieraid } = await req.json()
    if (!corridafinancieraid) {
      return new Response(JSON.stringify({ error: 'corridafinancieraid requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 1. Leer pago desde vista_pagos_cliente usando el JWT del cliente (RLS) ──
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: row, error: dbError } = await userClient
      .from('vista_pagos_cliente')
      .select('*')
      .eq('corridafinancieraid', Number(corridafinancieraid))
      .neq('payment_status', 'pagado')
      .single()

    if (dbError || !row) {
      return new Response(
        JSON.stringify({ error: 'Pago no encontrado, sin acceso, o ya fue pagado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Obtener datos del cliente y venta (sin RLS) ──
    const { data: venta } = await serviceClient
      .from('venta')
      .select('ventaid, quentli_customer_id, quentli_subscription_id')
      .eq('ventaid', row.ventaid)
      .single()

    const { data: cliente } = await serviceClient
      .from('cliente')
      .select('nombre, email, telefonocelular')
      .eq('clienteid', row.clienteid)
      .single()

    // ── 3. Verificar idempotencia: ¿ya existe un invoice para esta corrida? ──
    const { data: corridaRow } = await serviceClient
      .from('corridafinanciera')
      .select('quentli_invoice_id')
      .eq('corridafinancieraid', Number(corridafinancieraid))
      .single()

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const qHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    // ── 3b. Calcular monto actual (incluye recargo si ya venció) ──
    const base = Number(row.scheduled_amount ?? 0)
    const extra = Number(row.cargo_extra_amount ?? 0)
    const recargo = Number(row.recargo_pendiente ?? 0)
    const totalCentavos = Math.round((base + extra + recargo) * 100)
    const itemsPayload = [
      {
        concept: {
          displayName: `${row.payment_type ?? 'Mensualidad'} · ${row.lot_key ?? ''} (Venta #${row.ventaid})`,
          amount: totalCentavos,
          currency: 'MXN',
        },
        quantity: 1,
      },
    ]

    // Si ya existe el invoice: actualizar el monto al valor actual y devolver el link
    if (corridaRow?.quentli_invoice_id) {
      const existingInvoiceId = corridaRow.quentli_invoice_id

      // Verificar si el invoice sigue vigente en Quentli
      const checkRes = await fetch(`${QUENTLI_API}/v1/invoices/${existingInvoiceId}`, { headers: qHeaders })
      if (checkRes.ok) {
        const inv = await checkRes.json()
        const invoiceData = inv?.invoice ?? inv
        // Si ya está pagado, limpiar el ID para que se cree uno nuevo
        if (invoiceData?.isPaid || invoiceData?.canceledAt) {
          await serviceClient
            .from('corridafinanciera')
            .update({ quentli_invoice_id: null })
            .eq('corridafinancieraid', Number(corridafinancieraid))
        } else {
          // Actualizar el monto con el recargo actual antes de devolver el link
          await fetch(`${QUENTLI_API}/v1/invoices/${existingInvoiceId}`, {
            method: 'PATCH',
            headers: qHeaders,
            body: JSON.stringify({ input: { data: { items: itemsPayload } } }),
          })
          const linkRes = await fetch(
            `${QUENTLI_API}/v1/invoices/${existingInvoiceId}/payment-link`,
            { headers: qHeaders },
          )
          if (linkRes.ok) {
            const linkData = await linkRes.json()
            return new Response(
              JSON.stringify({ url: linkData.url, invoiceId: existingInvoiceId }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          }
        }
      }
      console.warn(`Invoice ${existingInvoiceId} no válido en Quentli, creando nuevo`)
    }

    // ── 4. Resolver quentli_customer_id ──
    let quentliCustomerId: string | null = venta?.quentli_customer_id ?? null

    if (!quentliCustomerId) {
      // Buscar por username (externalId = clienteid) en Quentli
      const filterUrl = `${QUENTLI_API}/v1/customers?filter[username][equals]=${encodeURIComponent(String(row.clienteid))}`
      const listRes = await fetch(filterUrl, { headers: qHeaders })
      if (listRes.ok) {
        try {
          const customers = await listRes.json()
          quentliCustomerId = customers[0]?.id ?? customers.data?.[0]?.id ?? null
        } catch { /* ignorar */ }
      }

      // Si aún no existe, crear el cliente en Quentli
      if (!quentliCustomerId) {
        const customerPayload: Record<string, unknown> = {
          username: String(row.clienteid),
          name: cliente?.nombre ?? `Cliente ${row.clienteid}`,
        }
        if (cliente?.email) customerPayload.email = cliente.email
        if (cliente?.telefonocelular) {
          const digits = String(cliente.telefonocelular).replace(/\D/g, '')
          if (digits.length === 10) customerPayload.phoneNumber = `+52${digits}`
        }

        const createCustRes = await fetch(`${QUENTLI_API}/v1/customers`, {
          method: 'POST',
          headers: qHeaders,
          body: JSON.stringify({ input: customerPayload }),
        })
        if (createCustRes.ok) {
          const custData = await createCustRes.json()
          quentliCustomerId = custData.customer?.id ?? custData.id ?? null
        }
      }

      // Guardar el customer ID en venta para futuras llamadas
      if (quentliCustomerId && venta?.ventaid) {
        await serviceClient
          .from('venta')
          .update({ quentli_customer_id: quentliCustomerId })
          .eq('ventaid', venta.ventaid)
      }
    }

    if (!quentliCustomerId) {
      throw new Error('No se pudo obtener el ID del cliente en Quentli')
    }

    // ── 5. Monto ya calculado en paso 3b (base + cargos + recargo actual)

    const dueDateLabel = row.due_date ?? new Date().toISOString().split('T')[0]
    // Convertir fecha a ISO 8601 con hora para Quentli
    const dueDateTime = /^\d{4}-\d{2}-\d{2}$/.test(dueDateLabel)
      ? `${dueDateLabel}T06:00:00.000Z`
      : dueDateLabel

    // ── 6. Construir body del invoice ──
    const invoiceBody: Record<string, unknown> = {
      input: {
        customerId: quentliCustomerId,
        dueDate: dueDateTime,
        collectionMethod: 'SEND_REMINDER', // Quentli envía recordatorios automáticos
        allowOfftimePayment: true,          // Puede pagar antes de la fecha límite
        items: itemsPayload,
        metadata: [
          { key: 'corridafinancieraid', value: String(corridafinancieraid) },
          { key: 'ventaid', value: String(row.ventaid) },
          { key: 'clienteid', value: String(row.clienteid) },
          { key: 'nopago', value: String(row.nopago ?? '') },
        ],
      },
    }

    // Adjuntar subscriptionId si la venta ya tiene una suscripción en Quentli
    if (venta?.quentli_subscription_id) {
      (invoiceBody.input as Record<string, unknown>).subscriptionId = venta.quentli_subscription_id
    }

    // ── 7. Crear el invoice en Quentli ──
    const invoiceRes = await fetch(`${QUENTLI_API}/v1/invoices`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify(invoiceBody),
    })

    if (!invoiceRes.ok) {
      const errText = await invoiceRes.text()
      throw new Error(`Error al crear invoice en Quentli (${invoiceRes.status}): ${errText}`)
    }

    const invoiceData = await invoiceRes.json()
    const invoiceId: string = invoiceData.invoice?.id ?? ''

    if (!invoiceId) {
      throw new Error('Quentli no devolvió el invoice ID')
    }

    // ── 8. Guardar invoice ID en la corrida financiera (idempotencia futura) ──
    await serviceClient
      .from('corridafinanciera')
      .update({ quentli_invoice_id: invoiceId })
      .eq('corridafinancieraid', Number(corridafinancieraid))

    // ── 9. Obtener el link de pago del invoice ──
    const linkRes = await fetch(
      `${QUENTLI_API}/v1/invoices/${invoiceId}/payment-link`,
      { headers: qHeaders },
    )

    if (!linkRes.ok) {
      const errText = await linkRes.text()
      throw new Error(`Error al obtener link del invoice (${linkRes.status}): ${errText}`)
    }

    const linkData = await linkRes.json()

    return new Response(
      JSON.stringify({ url: linkData.url, invoiceId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
