import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUENTLI_API = 'https://api.quentli.com'

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

    // ── 1. Crear cliente en Quentli ────────────────────────────
    let quentliCustomerId: string | undefined

    const customerPayload: Record<string, any> = {
      username: String(clienteid),
      name: nombre ?? `Cliente ${clienteid}`,
    }
    if (email) customerPayload.email = email
    if (telefono) customerPayload.phoneNumber = telefono

    const customerRes = await fetch(`${QUENTLI_API}/v1/customers`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify({ input: customerPayload }),
    })

    if (customerRes.ok) {
      const customerData = await customerRes.json()
      quentliCustomerId = customerData.id ?? customerData.customerId
    } else if (customerRes.status === 409) {
      // Cliente ya existe — buscar por username
      const listRes = await fetch(
        `${QUENTLI_API}/v1/customers?filter[username]=${encodeURIComponent(String(clienteid))}`,
        { headers: qHeaders },
      )
      if (listRes.ok) {
        const listData = await listRes.json()
        quentliCustomerId = listData.data?.[0]?.id ?? listData.data?.[0]?.customerId
      }
    } else {
      const errBody = await customerRes.text()
      throw new Error(`Error al crear cliente en Quentli: ${errBody}`)
    }

    if (!quentliCustomerId) {
      throw new Error('No se pudo obtener el ID del cliente en Quentli')
    }

    // ── 2. Crear suscripción mensual en Quentli ────────────────
    // Los montos en Quentli se expresan en centavos (pesos × 100)
    const fechaISO = new Date(`${fechaprimeramensualidad}T12:00:00`).toISOString()

    const subscriptionRes = await fetch(`${QUENTLI_API}/v1/subscriptions`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify({
        input: {
          customerId: quentliCustomerId,
          description: `Mensualidades ${clavelote ?? ''} · Venta #${ventaid}`,
          firstCollectionDate: fechaISO,
          numberOfPayments: Number(plazo),
          collectionMethod: 'AUTOMATIC',
          items: [
            {
              concept: {
                displayName: 'Mensualidad',
                amount: Math.round(Number(mensualidad) * 100), // pesos → centavos
                currency: 'MXN',
              },
              quantity: 1,
            },
          ],
        },
      }),
    })

    if (!subscriptionRes.ok) {
      const errBody = await subscriptionRes.text()
      throw new Error(`Error al crear suscripción en Quentli: ${errBody}`)
    }

    const subscriptionData = await subscriptionRes.json()

    return new Response(
      JSON.stringify({
        ok: true,
        quentliCustomerId,
        quentliSubscriptionId: subscriptionData.id,
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
