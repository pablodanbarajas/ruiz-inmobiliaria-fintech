import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUENTLI_API = 'https://api.demo.quentli.com'

/** Convierte teléfono mexicano a formato E.164. Si ya tiene + lo deja igual. */
function toE164(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return undefined
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Crea o reutiliza un cliente en Quentli y le asigna una suscripción mensual.
// Llamado desde el admin al registrar una nueva venta.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar que quien llama tiene rol admin o vendedor
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!roleData || !['admin', 'vendedor'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Sin permisos suficientes' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Datos de la venta a sincronizar
    const {
      clienteid,
      nombre,
      email,
      telefono,
      ventaid,
      clavelote,
      mensualidad,
      plazo,
      fechaprimeramensualidad,
    } = await req.json()

    if (!clienteid || !mensualidad || !plazo || !fechaprimeramensualidad) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: clienteid, mensualidad, plazo, fechaprimeramensualidad' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const qHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    // ── 1. Crear cliente en Quentli (o buscarlo si ya existe) ────
    let quentliCustomerId: string | undefined

    const customerPayload: Record<string, any> = {
      username: String(clienteid),
      name: nombre ?? `Cliente ${clienteid}`,
    }
    if (email) customerPayload.email = email
    const e164 = toE164(telefono)
    if (e164) customerPayload.phoneNumber = e164

    const customerRes = await fetch(`${QUENTLI_API}/v1/customers`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify({ input: customerPayload }),
    })

    if (customerRes.ok) {
      const customerData = await customerRes.json()
      // Respuesta: { customer: { id } }
      quentliCustomerId = customerData.customer?.id ?? customerData.id
      console.log('Customer created, id:', quentliCustomerId)
    } else {
      // Cliente ya existe u otro error — buscar por username con qs filter (doc oficial)
      const errStatus = customerRes.status
      let errBody = ''
      try { errBody = await customerRes.text() } catch { /* ignorar */ }
      console.log(`Customer POST failed (${errStatus}): ${errBody.substring(0, 200)} — buscando por username`)

      // GET /v1/customers?filter[username][equals]=999999
      const filterUrl = `${QUENTLI_API}/v1/customers?filter[username][equals]=${encodeURIComponent(String(clienteid))}`
      const listRes = await fetch(filterUrl, { headers: qHeaders })
      const listText = await listRes.text()
      console.log(`customer search → ${listRes.status}: ${listText.substring(0, 300)}`)
      if (listRes.ok) {
        try {
          const customers = JSON.parse(listText) // array según OpenAPI
          quentliCustomerId = customers[0]?.id ?? customers.data?.[0]?.id
          console.log('Found customer via filter, id:', quentliCustomerId)
        } catch { /* ignorar */ }
      }
    }

    if (!quentliCustomerId) {
      console.error('No se pudo obtener quentliCustomerId', { clienteid })
      throw new Error('No se pudo obtener el ID del cliente en Quentli')
    }

    // ── 2. Crear concepto de pago en Quentli ──────────────────
    // Endpoint correcto: POST /v1/payment-concepts (no /v1/concepts)
    const montocentavos = Math.round(Number(mensualidad) * 100)

    const conceptRes = await fetch(`${QUENTLI_API}/v1/payment-concepts`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify({
        input: {
          displayName: `Mensualidad ${clavelote ?? ''} · Venta #${ventaid}`,
          amount: montocentavos,
          currency: 'MXN',
          recurrentDetail: {
            collectionInterval: 'MONTH',
            chargeEach: 1,
          },
        },
      }),
    })

    if (!conceptRes.ok) {
      const conceptErr = await conceptRes.text()
      throw new Error(`Error al crear concepto en Quentli: ${conceptErr}`)
    }
    const conceptData = await conceptRes.json()
    // Respuesta: { paymentConcept: { id } }
    const conceptId: string = conceptData.paymentConcept?.id ?? conceptData.id
    console.log('Concept created, id:', conceptId)

    if (!conceptId) throw new Error('No se pudo obtener el conceptId de Quentli')

    // ── 3. Crear suscripción mensual en Quentli ────────────────
    // nextCollectionDate = primera fecha de cobro (doc: "Required when using recurring items")
    const fechaISO = new Date(`${fechaprimeramensualidad}T12:00:00`).toISOString()

    const subscriptionRes = await fetch(`${QUENTLI_API}/v1/subscriptions`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify({
        input: {
          customerId: quentliCustomerId,
          description: `Mensualidades ${clavelote ?? ''} · Venta #${ventaid}`,
          nextCollectionDate: fechaISO,
          numberOfPayments: Number(plazo),
          collectionMethod: 'SEND_REMINDER',
          items: [{ conceptId, quantity: 1 }],
        },
      }),
    })

    if (!subscriptionRes.ok) {
      const errBody = await subscriptionRes.text()
      throw new Error(`Error al crear suscripción en Quentli: ${errBody}`)
    }

    const subscriptionData = await subscriptionRes.json()
    // Respuesta: { subscription: { id } }
    const subscriptionId = subscriptionData.subscription?.id ?? subscriptionData.id

    return new Response(
      JSON.stringify({
        ok: true,
        quentliCustomerId,
        quentliConceptId: conceptId,
        quentliSubscriptionId: subscriptionId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
