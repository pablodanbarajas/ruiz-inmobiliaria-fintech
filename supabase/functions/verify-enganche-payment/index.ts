import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = 'https://api.demo.quentli.com'

/**
 * Verifica el pago de enganche en Quentli.
 * Si FINALIZED:
 *   - Actualiza venta.estatus = 'A' (Activa)
 *   - Registra fechaenganche = hoy
 *   - Crea registro en pagos
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  const preflight = handleCors(req)
  if (preflight) return preflight
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

    const { data: { user }, error: userError } = await serviceClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { ventaid, sessionId } = await req.json()
    const ventaId = Number(ventaid)
    if (!Number.isInteger(ventaId) || ventaId <= 0) {
      return new Response(JSON.stringify({ error: 'ventaid debe ser un entero válido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'sessionId es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar que la venta pertenece al cliente autenticado
    const { data: cliente } = await serviceClient
      .from('cliente')
      .select('clienteid')
      .eq('email', user.email!)
      .maybeSingle()

    if (!cliente) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: venta, error: ventaErr } = await serviceClient
      .from('venta')
      .select('ventaid, estatus, enganche, monto_apartado_pagado, loteid, clienteid')
      .eq('ventaid', ventaId)
      .eq('clienteid', cliente.clienteid)
      .single()

    if (ventaErr || !venta) {
      return new Response(JSON.stringify({ error: 'Venta no encontrada o sin acceso' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Si ya está en 'A', el enganche ya fue registrado
    if (venta.estatus === 'A' || venta.estatus === 'V') {
      return new Response(JSON.stringify({ ok: true, alreadyRegistered: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar idempotencia: ¿ya existe un pago con esta referencia?
    const { data: pagoExistente } = await serviceClient
      .from('pagos')
      .select('pagoid')
      .eq('referencia', sessionId)
      .maybeSingle()

    if (pagoExistente) {
      return new Response(JSON.stringify({ ok: true, alreadyRegistered: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Consultar estado de la sesión de pago en Quentli
    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const qRes = await fetch(`${QUENTLI_API}/v1/payment-sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    })

    if (!qRes.ok) {
      const errText = await qRes.text()
      throw new Error(`Error consultando Quentli (${qRes.status}): ${errText}`)
    }

    const session = await qRes.json()

    if (session?.status !== 'FINALIZED') {
      return new Response(JSON.stringify({
        ok: false,
        sessionStatus: session?.status ?? 'UNKNOWN',
        message: 'El pago de enganche aún no se ha completado',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const montoEnganche = Math.round(Number(session.totalAmount ?? 0)) / 100
    const today = new Date().toISOString().split('T')[0]

    // Actualizar venta: estatus='A', fechaenganche=hoy
    await serviceClient
      .from('venta')
      .update({
        estatus: 'A',
        fechaenganche: today,
        fechacontrato: today, // La fecha de contrato = fecha de enganche (según minuta)
      })
      .eq('ventaid', ventaid)

    // Registrar el pago de enganche
    // Buscamos la corrida nopago=0 si ya existe (venta formalizada), si no lo dejamos sin corrida
    const { data: corrida0 } = await serviceClient
      .from('corridafinanciera')
      .select('corridafinancieraid')
      .eq('ventaid', ventaid)
      .eq('nopago', 0)
      .maybeSingle()

    const { error: pagoInsertError } = await serviceClient
      .from('pagos')
      .insert({
        corridafinancieraid: corrida0?.corridafinancieraid ?? null,
        fechapago: today,
        montopagado: montoEnganche,
        formapago: 4,
        estatus: 'P',
        referencia: sessionId,
        comentario: `Pago de enganche vía portal · Venta ${ventaid} (sesión Quentli: ${sessionId})`,
      })

    if (pagoInsertError) {
      // Si falla por NOT NULL en corridafinancieraid, insertar sin el campo
      console.error('Error insertando pago con corrida:', pagoInsertError.message)
    }

    return new Response(JSON.stringify({
      ok: true,
      registered: true,
      montoEnganche,
      message: 'Enganche registrado. El admin completará los detalles de la venta.',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
