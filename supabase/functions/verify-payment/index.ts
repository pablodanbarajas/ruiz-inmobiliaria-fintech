import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = 'https://api.demo.quentli.com'

/**
 * Verifica el estado de una sesión de pago de Quentli y registra el pago en Supabase
 * si la sesión está FINALIZED (completada). Solución fallback cuando el webhook no dispara.
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

    const { sessionId, corridafinancieraid } = await req.json()

    if (!sessionId || !corridafinancieraid) {
      return new Response(JSON.stringify({ error: 'sessionId y corridafinancieraid requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Detectar si se envió un invoice ID (nuevo flujo) o un session ID (legado)
    const isInvoice = String(sessionId).startsWith('inv_')

    const corridaId = Number(corridafinancieraid)
    if (isNaN(corridaId)) {
      return new Response(JSON.stringify({ error: 'corridafinancieraid inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar que la corrida pertenece al usuario autenticado (seguridad)
    // Usamos el JWT del usuario para que RLS de vista_pagos_cliente aplique
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: corridaRow, error: corridaErr } = await userClient
      .from('vista_pagos_cliente')
      .select('corridafinancieraid, ventaid')
      .eq('corridafinancieraid', corridaId)
      .single()

    if (corridaErr || !corridaRow) {
      return new Response(JSON.stringify({ error: 'Corrida no encontrada o sin acceso' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar idempotencia: ¿ya existe un pago para esta corrida?
    const { data: pagoExistente } = await serviceClient
      .from('pagos')
      .select('pagoid, montopagado')
      .eq('corridafinancieraid', corridaId)
      .eq('estatus', 'P')
      .maybeSingle()

    if (pagoExistente) {
      return new Response(
        JSON.stringify({ ok: true, alreadyRegistered: true, pagoid: pagoExistente.pagoid }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Consultar el estado del pago en Quentli según el tipo de referencia
    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const qHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    let montopagado = 0
    let metaCorridaId = corridaId
    let referencia = sessionId

    if (isInvoice) {
      // ── Nuevo flujo: verificar invoice ──
      const qRes = await fetch(`${QUENTLI_API}/v1/invoices/${sessionId}`, { headers: qHeaders })
      if (!qRes.ok) {
        const errText = await qRes.text()
        throw new Error(`Error consultando invoice en Quentli (${qRes.status}): ${errText}`)
      }
      const invoice = await qRes.json()
      const inv = invoice?.invoice ?? invoice

      if (!inv?.isPaid) {
        return new Response(
          JSON.stringify({ ok: false, status: 'UNPAID', message: 'El pago aún no se ha completado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      montopagado = (inv.amountPaid ?? inv.totalAmount ?? 0) / 100
      // Extraer corridafinancieraid desde meta del invoice
      const metaMap: Record<string, string> = inv.meta ?? {}
      if (metaMap['corridafinancieraid']) {
        const parsed = parseInt(metaMap['corridafinancieraid'], 10)
        if (!isNaN(parsed)) metaCorridaId = parsed
      }
    } else {
      // ── Flujo legado: verificar payment-session ──
      const qRes = await fetch(`${QUENTLI_API}/v1/payment-sessions/${sessionId}`, { headers: qHeaders })
      if (!qRes.ok) {
        const errText = await qRes.text()
        throw new Error(`Error consultando Quentli (${qRes.status}): ${errText}`)
      }
      const session = await qRes.json()

      if (session?.status !== 'FINALIZED') {
        return new Response(
          JSON.stringify({ ok: false, sessionStatus: session?.status ?? 'UNKNOWN', message: 'El pago aún no se ha completado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      montopagado = (session.totalAmount ?? 0) / 100
      const metadataList: Array<{ key: string; value: string }> = session.metadata ?? []
      const metaMapLegacy = Object.fromEntries(metadataList.map((m) => [m.key, m.value]))
      if (metaMapLegacy['corridafinancieraid']) {
        const parsed = parseInt(metaMapLegacy['corridafinancieraid'], 10)
        if (!isNaN(parsed)) metaCorridaId = parsed
      }
    }

    // Registrar el pago en Supabase
    const { data: pago, error: pagoError } = await serviceClient
      .from('pagos')
      .insert({
        corridafinancieraid: metaCorridaId,
        fechapago: new Date().toISOString().split('T')[0],
        montopagado,
        formapago: 4, // Tarjeta
        estatus: 'P',
        referencia,
        comentario: isInvoice
          ? `Pago verificado desde portal (invoice Quentli: ${referencia})`
          : `Pago verificado desde portal (sesión Quentli: ${referencia})`,
      })
      .select()
      .single()

    if (pagoError) {
      throw new Error(`Error al insertar pago: ${pagoError.message}`)
    }

    return new Response(
      JSON.stringify({ ok: true, registered: true, pagoid: pago.pagoid, montopagado }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
