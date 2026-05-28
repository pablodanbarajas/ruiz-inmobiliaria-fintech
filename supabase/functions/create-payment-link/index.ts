import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUENTLI_API = 'https://api.demo.quentli.com'

/** Convierte teléfono mexicano a formato E.164. Si ya tiene + lo deja igual. */
function toE164(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+52${digits}`           // 10 dígitos → México
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}` // ya con código país
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`  // EE.UU.
  if (phone.startsWith('+')) return phone                   // ya en E.164
  return undefined                                           // no reconocido → omitir
}

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

    const dueDate = new Date().toISOString() // Hoy → Quentli lo acepta de inmediato
    const dueDateLabel = row.due_date        // Fecha real para mostrar en descripción

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const qHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    // ── Asegurar que el cliente existe en Quentli (upsert) ──────
    const customerPayload: Record<string, any> = {
      username: String(row.clienteid),
      name: cliente?.nombre ?? `Cliente ${row.clienteid}`,
    }
    if (cliente?.email) customerPayload.email = cliente.email
    const e164 = toE164(cliente?.telefonocelular)
    if (e164) customerPayload.phoneNumber = e164

    const custRes = await fetch(`${QUENTLI_API}/v1/customers`, {
      method: 'POST',
      headers: qHeaders,
      body: JSON.stringify({ input: customerPayload }),
    })
    // 409 = ya existe → ignorar, cualquier otro error no-ok → lanzar
    if (!custRes.ok && custRes.status !== 409) {
      const errText = await custRes.text()
      throw new Error(`Error al crear cliente en Quentli (${custRes.status}): ${errText}`)
    }

    const body: Record<string, any> = {
      input: {
        customer: {
          name: cliente?.nombre ?? `Cliente ${row.clienteid}`,
          username: String(row.clienteid),
          ...(cliente?.email ? { email: cliente.email } : {}),
          ...(e164 ? { phoneNumber: e164 } : {}),
        },
        dueDate,
        collectionMethod: 'SEND_REMINDER',
        items: [
          {
            description: `${row.payment_type ?? 'Mensualidad'} · ${row.lot_key ?? ''} (vence ${dueDateLabel})`,
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
      headers: qHeaders,
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
