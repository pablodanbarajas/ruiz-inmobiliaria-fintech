import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Formaliza una venta proveniente del portal:
 * 1. Elimina corridas previas (si existen)
 * 2. Genera la corrida financiera (nopago 0..plazo)
 * 3. Actualiza venta con plazo y mensualidad
 * 4. Cambia lote a 'V' (Vendido)
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

    // Verificar token y rol admin
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userRole } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!userRole || !['admin', 'vendedor'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Sin permiso' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { ventaid, plazo, fechaprimeramensualidad } = await req.json()

    if (!ventaid || !plazo || !fechaprimeramensualidad) {
      return new Response(JSON.stringify({ error: 'ventaid, plazo y fechaprimeramensualidad son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const plazoNum = parseInt(plazo)
    if (isNaN(plazoNum) || plazoNum <= 0) {
      return new Response(JSON.stringify({ error: 'Plazo inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener datos de la venta
    const { data: venta, error: ventaErr } = await serviceClient
      .from('venta')
      .select('ventaid, preciolote, enganche, fechaenganche, loteid, estatus')
      .eq('ventaid', Number(ventaid))
      .single()

    if (ventaErr || !venta) {
      return new Response(JSON.stringify({ error: 'Venta no encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const preciolote = Number(venta.preciolote ?? 0)
    const enganche = Number(venta.enganche ?? 0)
    const saldoInicial = preciolote - enganche
    const mensualidad = parseFloat((saldoInicial / plazoNum).toFixed(2))
    const fechaEnganche = venta.fechaenganche ?? new Date().toISOString().split('T')[0]

    // 1. Eliminar corridas previas (con service role — sin RLS)
    const { error: deleteError, count: deleteCount } = await serviceClient
      .from('corridafinanciera')
      .delete({ count: 'exact' })
      .eq('ventaid', Number(ventaid))

    if (deleteError) {
      throw new Error(`Error al eliminar corridas: ${deleteError.message}`)
    }

    console.log(`Deleted ${deleteCount} corridas for ventaid=${ventaid}`)

    // Verificar que quedaron 0 registros
    const { data: remaining, error: selectErr } = await serviceClient
      .from('corridafinanciera')
      .select('corridafinancieraid, nopago')
      .eq('ventaid', Number(ventaid))

    if (selectErr) throw new Error(`Error verificando corridas: ${selectErr.message}`)

    if (remaining && remaining.length > 0) {
      throw new Error(`No se pudieron eliminar ${remaining.length} corridas: nopago=[${remaining.map((r: any) => r.nopago).join(',')}]. Posiblemente tienen pagos asociados.`)
    }

    // 2. Generar corrida financiera
    const corridaRecords: { ventaid: number; nopago: number; fecha: string; mensualidad: number; saldo: number }[] = []

    // nopago=0: enganche
    corridaRecords.push({
      ventaid: Number(ventaid),
      nopago: 0,
      fecha: fechaEnganche,
      mensualidad: enganche,
      saldo: saldoInicial,
    })

    // nopago=1..plazo: mensualidades
    const fechaPrimera = new Date(fechaprimeramensualidad + 'T12:00:00')
    for (let i = 1; i <= plazoNum; i++) {
      const fecha = new Date(fechaPrimera)
      fecha.setMonth(fecha.getMonth() + (i - 1))
      const saldo = i === plazoNum ? 0 : Math.max(0, parseFloat((saldoInicial - mensualidad * i).toFixed(2)))
      corridaRecords.push({
        ventaid: Number(ventaid),
        nopago: i,
        fecha: fecha.toISOString().split('T')[0],
        mensualidad,
        saldo,
      })
    }

    const { error: corridaError } = await serviceClient
      .from('corridafinanciera')
      .insert(corridaRecords)

    if (corridaError) {
      throw new Error(`Error al crear corrida: ${corridaError.message}`)
    }

    // 4. Enlazar el pago de enganche (corridafinancieraid=null) a nopago=0
    // Buscar el corridafinancieraid del nopago=0 recién creado
    const { data: corrida0 } = await serviceClient
      .from('corridafinanciera')
      .select('corridafinancieraid')
      .eq('ventaid', Number(ventaid))
      .eq('nopago', 0)
      .single()

    if (corrida0) {
      // Actualizar pagos sin corrida asociada que sean de enganche para esta venta
      await serviceClient
        .from('pagos')
        .update({ corridafinancieraid: corrida0.corridafinancieraid })
        .is('corridafinancieraid', null)
        .ilike('comentario', `%Venta ${ventaid}%`)
        .ilike('comentario', '%enganche%')
    }

    // 3. Actualizar venta con plazo y mensualidad
    await serviceClient
      .from('venta')
      .update({ plazo: plazoNum, mensualidad, fechaprimeramensualidad })
      .eq('ventaid', Number(ventaid))

    // 4. Cambiar lote a Vendido
    if (venta.loteid) {
      await serviceClient
        .from('lote')
        .update({ estatus: 'V' })
        .eq('loteid', venta.loteid)
        .in('estatus', ['A', 'D'])
    }

    return new Response(JSON.stringify({
      ok: true,
      mensualidad,
      plazo: plazoNum,
      corridasCreadas: corridaRecords.length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
