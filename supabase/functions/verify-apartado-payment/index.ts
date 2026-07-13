import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = 'https://api.demo.quentli.com'

/**
 * Verifica una sesión de pago de Quentli para un apartado.
 * Si está FINALIZED, actualiza la venta a 'E' (En enganche) y registra el pago.
 * Retorna los datos del enganche pendiente.
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

    const { ventaid } = await req.json()
    if (!ventaid) {
      return new Response(JSON.stringify({ error: 'ventaid es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener la venta y verificar que pertenece al usuario autenticado
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
      .select('ventaid, estatus, loteid, enganche, preciolote, monto_apartado_pagado, quentli_apartado_session_id, fecha_limite_enganche, clienteid')
      .eq('ventaid', ventaid)
      .eq('clienteid', cliente.clienteid) // seguridad: solo el propietario
      .single()

    if (ventaErr || !venta) {
      return new Response(JSON.stringify({ error: 'Venta no encontrada o sin acceso' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const montoEnganche = Number(venta.enganche ?? 0)

    // Si ya está verificada (E o A), devolver los datos sin volver a llamar Quentli
    if (venta.estatus === 'E' || venta.estatus === 'A') {
      const montoApartado = Number(venta.monto_apartado_pagado ?? 0)
      return new Response(JSON.stringify({
        ok: true,
        alreadyVerified: true,
        montoApartado,
        montoEnganche,
        montoRestante: Math.max(0, montoEnganche - montoApartado),
        fechaLimiteEnganche: venta.fecha_limite_enganche,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verificar que la venta está en estado pendiente
    if (venta.estatus !== 'P') {
      return new Response(
        JSON.stringify({ ok: false, message: `La venta tiene estatus '${venta.estatus}', no se puede verificar` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sessionId = venta.quentli_apartado_session_id
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'No hay sesión de pago asociada a esta reserva' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Consultar estado de la sesión en Quentli
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
        message: 'El pago de apartado aún no se ha completado',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Pago confirmado: calcular monto y enganche restante
    const montoApartado = Math.round(Number(session.totalAmount ?? 0)) / 100
    const montoRestante = Math.max(0, montoEnganche - montoApartado)
    const fechaLimiteEnganche = new Date()
    fechaLimiteEnganche.setDate(fechaLimiteEnganche.getDate() + 15)
    const fechaLimiteStr = fechaLimiteEnganche.toISOString().split('T')[0]

    // Verificar idempotencia: ¿ya existe un pago registrado?
    const { data: pagoExistente } = await serviceClient
      .from('pagos')
      .select('pagoid')
      .eq('referencia', sessionId)
      .maybeSingle()

    // Obtener info del lote y desarrollo para enriquecer la respuesta
    const { data: loteInfo } = await serviceClient
      .from('lote')
      .select('nolote, manzana, coto, superficie, preciolote, desarrollo:desarrolloid(desarrolloid, nombre)')
      .eq('loteid', venta.loteid)
      .maybeSingle()

    if (!pagoExistente) {
      // Actualizar venta a 'E' (En enganche)
      await serviceClient
        .from('venta')
        .update({
          estatus: 'E',
          monto_apartado_pagado: montoApartado,
          fecha_limite_enganche: fechaLimiteStr,
        })
        .eq('ventaid', ventaid)

      // Registrar pago (sin corridafinancieraid por ahora — aún no hay corrida)
      await serviceClient
        .from('pagos')
        .insert({
          corridafinancieraid: null,
          fechapago: new Date().toISOString().split('T')[0],
          montopagado: montoApartado,
          formapago: 4,
          estatus: 'P',
          referencia: sessionId,
          comentario: `Pago de apartado · Lote ${loteInfo?.nolote ?? ''} Mza ${loteInfo?.manzana ?? ''} · Venta ${ventaid} (sesión Quentli: ${sessionId})`,
        })
    }

    const desarrollo = loteInfo?.desarrollo as any

    return new Response(JSON.stringify({
      ok: true,
      registered: !pagoExistente,
      montoApartado,
      montoEnganche,
      montoRestante,
      fechaLimiteEnganche: fechaLimiteStr,
      lote: {
        nolote: loteInfo?.nolote,
        manzana: loteInfo?.manzana,
        superficie: loteInfo?.superficie,
        preciolote: loteInfo?.preciolote,
      },
      desarrollo: {
        nombre: desarrollo?.nombre,
        id: desarrollo?.desarrolloid,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
