import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUENTLI_API = 'https://api.demo.quentli.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Crea una reserva de lote (venta estatus='P'), bloquea el lote (estatus='A'),
 * y genera una sesión de pago en Quentli para el monto de apartado.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar token JWT
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { loteid, desarrolloid } = await req.json()
    if (!loteid || !desarrolloid) {
      return new Response(JSON.stringify({ error: 'loteid y desarrolloid son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Expirar reservas antiguas antes de crear una nueva
    await serviceClient.rpc('expire_reservations').catch(() => {})

    // Buscar cliente por email del usuario autenticado
    const { data: cliente } = await serviceClient
      .from('cliente')
      .select('clienteid, nombre, telefonocelular, email')
      .eq('email', user.email!)
      .maybeSingle()

    if (!cliente) {
      return new Response(
        JSON.stringify({ error: 'No se encontró un cliente asociado a este usuario. Contacta a tu asesor.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener datos del desarrollo (monto apartado y enganche)
    const { data: desarrollo } = await serviceClient
      .from('desarrollo')
      .select('desarrolloid, nombre, montominimoapartado, enganche')
      .eq('desarrolloid', desarrolloid)
      .single()

    if (!desarrollo) {
      return new Response(JSON.stringify({ error: 'Desarrollo no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const montoApartado = Number(desarrollo.montominimoapartado ?? 2000)
    const montoEnganche = Number(desarrollo.enganche ?? 15000)

    // Obtener datos del lote
    const { data: lote } = await serviceClient
      .from('lote')
      .select('loteid, estatus, preciolote, nolote, manzana, coto, superficie')
      .eq('loteid', loteid)
      .single()

    if (!lote) {
      return new Response(JSON.stringify({ error: 'Lote no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (lote.estatus !== 'D') {
      return new Response(
        JSON.stringify({ error: 'El lote ya no está disponible para apartar' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // LOCK ATÓMICO: cambiar lote de 'D' → 'A' solo si sigue disponible
    const { data: lockedLote, error: lockError } = await serviceClient
      .from('lote')
      .update({ estatus: 'A' })
      .eq('loteid', loteid)
      .eq('estatus', 'D')
      .select()

    if (lockError || !lockedLote || lockedLote.length === 0) {
      return new Response(
        JSON.stringify({ error: 'El lote acaba de ser reservado por otro cliente. Por favor elige otro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear venta con estatus='P' (Pendiente — esperando pago de apartado)
    const { data: venta, error: ventaError } = await serviceClient
      .from('venta')
      .insert({
        loteid,
        clienteid: cliente.clienteid,
        fecha: new Date().toISOString().split('T')[0],
        preciolote: lote.preciolote,
        enganche: montoEnganche,
        estatus: 'P',
        fecha_reserva: new Date().toISOString(),
        monto_apartado_pagado: 0,
        comentarios: `Reserva creada desde portal (${desarrollo.nombre})`,
      })
      .select()
      .single()

    if (ventaError || !venta) {
      // Rollback: liberar lote
      await serviceClient.from('lote').update({ estatus: 'D' }).eq('loteid', loteid)
      throw new Error(`Error al crear reserva: ${ventaError?.message}`)
    }

    // Crear sesión de pago en Quentli para el monto de apartado
    const portalUrl = (Deno.env.get('PORTAL_URL') ?? 'https://ruiz-inmobiliaria-fintech.vercel.app/portal')
      .replace(/\/set-password.*$/, '')
      .replace(/\/$/, '')

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''

    const sessionBody = {
      input: {
        customer: {
          name: cliente.nombre ?? `Cliente ${cliente.clienteid}`,
          externalId: String(cliente.clienteid),
        },
        items: [{
          description: `Apartado · Lote ${lote.nolote} Mza ${lote.manzana} (${desarrollo.nombre})`,
          amount: Math.round(montoApartado * 100), // centavos
          quantity: 1,
          currency: 'MXN',
        }],
        metadata: [
          { key: 'ventaid',    value: String(venta.ventaid) },
          { key: 'loteid',     value: String(loteid) },
          { key: 'clienteid',  value: String(cliente.clienteid) },
          { key: 'tipo',       value: 'apartado' },
        ],
        returnUrl: `${portalUrl}/mapa/pagado.html?ventaid=${venta.ventaid}&tipo=apartado`,
      }
    }

    const qRes = await fetch(`${QUENTLI_API}/v1/payment-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    })

    if (!qRes.ok) {
      const errText = await qRes.text()
      // Rollback
      await serviceClient.from('venta').update({ estatus: 'C' }).eq('ventaid', venta.ventaid)
      await serviceClient.from('lote').update({ estatus: 'D' }).eq('loteid', loteid)
      throw new Error(`Error al generar link de pago (${qRes.status}): ${errText}`)
    }

    const qData = await qRes.json()
    const sessionId: string = qData.url?.split('/s/')?.[1]?.split('?')?.[0] ?? ''

    // Guardar sessionId en la venta
    await serviceClient
      .from('venta')
      .update({ quentli_apartado_session_id: sessionId })
      .eq('ventaid', venta.ventaid)

    return new Response(JSON.stringify({
      ok: true,
      url: qData.url,
      ventaid: venta.ventaid,
      montoApartado,
      montoEnganche,
      lote: {
        nolote: lote.nolote,
        manzana: lote.manzana,
        superficie: lote.superficie,
        preciolote: lote.preciolote,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
