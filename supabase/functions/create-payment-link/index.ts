import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = 'https://api.demo.quentli.com'

// Genera un link de pago autenticado en Quentli para que el cliente pague
// el total exacto de una mensualidad (mensualidad base + cargos extra + recargo).
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

    const dueDateLabel = row.due_date        // Fecha real para mostrar en descripción

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const qHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    // payment-sessions resuelve/crea el cliente automáticamente via externalId
    const body: Record<string, any> = {
      input: {
        customer: {
          name: cliente?.nombre ?? `Cliente ${row.clienteid}`,
          externalId: String(row.clienteid),
        },
        items: [
          {
            description: `${row.payment_type ?? 'Mensualidad'} · ${row.lot_key ?? ''} (vence ${dueDateLabel})`,
            amount: totalCentavos,
            quantity: 1,
            currency: 'MXN',
          },
        ],
        metadata: [
          { key: 'corridafinancieraid', value: String(corridafinancieraid) },
          { key: 'ventaid', value: String(row.ventaid) },
          { key: 'clienteid', value: String(row.clienteid) },
        ],
        returnUrl: `${(Deno.env.get('PORTAL_URL') ?? 'https://ruiz-inmobiliaria.trustcapitalia.com/portal').replace(/\/set-password.*$/, '').replace(/\/$/, '')}/mis-pagos?corridafinancieraid=${corridafinancieraid}`,
      },
    }

    const res = await fetch(`${QUENTLI_API}/v1/payment-sessions`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Error en Quentli (${res.status}): ${errText}`)
    }

    const data = await res.json()

    // Extraer el sessionId de la URL de Quentli: https://innco.demo.quentli.com/s/ps_XXXXX?cs=...
    const sessionId: string = data.url?.split('/s/')?.[1]?.split('?')?.[0] ?? ''

    return new Response(JSON.stringify({ url: data.url, sessionId }), {
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
