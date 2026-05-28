import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUENTLI_API = 'https://api.demo.quentli.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Genera un link de pago autenticado en Quentli para que el cliente pague
// el total exacto de una mensualidad (mensualidad base + cargos extra + recargo).
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente con JWT del usuario → auth.uid() funciona correctamente en la vista
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    // Cliente con service role → para queries que no dependen de auth.uid()
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

    // Consultar la vista CON el JWT del usuario → auth.uid() = user.id → RLS correcto
    const { data: row, error: dbError } = await userClient
      .from('vista_pagos_cliente')
      .select('*')
      .eq('corridafinancieraid', corridafinancieraid)
      .neq('payment_status', 'pagado')
      .single()

    if (dbError || !row) {
      return new Response(
        JSON.stringify({ error: 'Pago no encontrado, sin acceso, o ya fue pagado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Obtener nombre del cliente (sin restricción de RLS)
    const { data: cliente } = await serviceClient
      .from('cliente')
      .select('nombre, email, telefonocelular')
      .eq('clienteid', row.clienteid)
      .single()

    // Total en centavos (Quentli usa centavos)
    const base = Number(row.scheduled_amount ?? 0)
    const extra = Number(row.cargo_extra_amount ?? 0)
    const recargo = Number(row.recargo_pendiente ?? 0)
    const totalCentavos = Math.round((base + extra + recargo) * 100)

    const dueDate = new Date(`${row.due_date}T12:00:00`).toISOString()

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''

    const body: Record<string, any> = {
      input: {
        customer: {
          name: cliente?.nombre ?? `Cliente ${row.clienteid}`,
          username: String(row.clienteid),
          ...(cliente?.email ? { email: cliente.email } : {}),
          ...(cliente?.telefonocelular ? { phoneNumber: cliente.telefonocelular } : {}),
        },
        dueDate,
        collectionMethod: 'SEND_REMINDER',
        items: [
          {
            description: `${row.payment_type ?? 'Mensualidad'} · ${row.lot_key ?? ''}`,
            amount: totalCentavos,
            quantity: 1,
          },
        ],
        metadata: [
          { key: 'corridafinancieraid', value: String(corridafinancieraid) },
          { key: 'ventaid', value: String(row.ventaid) },
          { key: 'clienteid', value: String(row.clienteid) },
        ],
      },
    }

    const res = await fetch(`${QUENTLI_API}/v1/invoice-payment-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Error en Quentli (${res.status}): ${errText}`)
    }

    const data = await res.json()

    return new Response(JSON.stringify({ url: data.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
