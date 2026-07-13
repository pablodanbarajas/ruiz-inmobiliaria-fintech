import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = 'https://api.demo.quentli.com'

/**
 * Crea una sesión de pago de Quentli para el enganche restante de una venta.
 * Solo disponible para ventas con estatus='E' (apartado pagado, enganche pendiente).
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

    // Buscar cliente por email
    const { data: cliente } = await serviceClient
      .from('cliente')
      .select('clienteid, nombre')
      .eq('email', user.email!)
      .maybeSingle()

    if (!cliente) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener la venta (verificar que pertenece al cliente y está en fase 'E')
    const { data: venta, error: ventaErr } = await serviceClient
      .from('venta')
      .select('ventaid, estatus, enganche, monto_apartado_pagado, loteid, clienteid, fecha_limite_enganche')
      .eq('ventaid', Number(ventaid))
      .eq('clienteid', cliente.clienteid)
      .single()

    if (ventaErr || !venta) {
      return new Response(JSON.stringify({ error: 'Venta no encontrada o sin acceso' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (venta.estatus !== 'E') {
      return new Response(JSON.stringify({ error: `La venta no está en fase de enganche (estatus actual: ${venta.estatus})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const engancheTotal = Number(venta.enganche ?? 0)
    const apartadoPagado = Number(venta.monto_apartado_pagado ?? 0)
    const montoRestante = Math.max(0, engancheTotal - apartadoPagado)

    if (montoRestante <= 0) {
      return new Response(JSON.stringify({ error: 'El enganche ya fue liquidado completamente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener info del lote para la descripción
    const { data: lote } = await serviceClient
      .from('lote')
      .select('nolote, manzana, desarrollo:desarrolloid(nombre, desarrolloid)')
      .eq('loteid', venta.loteid)
      .maybeSingle()

    const desarrolloData = lote?.desarrollo as any
    const loteDesc = `Lote ${lote?.nolote ?? ''} Mza ${lote?.manzana ?? ''} (${desarrolloData?.nombre ?? ''})`
    const desarrolloid = desarrolloData?.desarrolloid ?? ''

    // Crear sesión de pago en Quentli
    const portalUrl = (Deno.env.get('PORTAL_URL') ?? 'https://ruiz-inmobiliaria-fintech.vercel.app/portal')
      .replace(/\/set-password.*$/, '').replace(/\/$/, '')

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''

    const sessionBody = {
      input: {
        customer: {
          name: cliente.nombre ?? `Cliente ${cliente.clienteid}`,
          externalId: String(cliente.clienteid),
        },
        items: [{
          description: `Enganche restante · ${loteDesc}`,
          amount: Math.round(montoRestante * 100), // centavos
          quantity: 1,
          currency: 'MXN',
        }],
        metadata: [
          { key: 'ventaid', value: String(venta.ventaid) },
          { key: 'clienteid', value: String(cliente.clienteid) },
          { key: 'tipo', value: 'enganche' },
        ],
        returnUrl: `${portalUrl}/mis-lotes?enganche_ventaid=${venta.ventaid}&desarrolloid=${desarrolloid}`,
      }
    }

    const qRes = await fetch(`${QUENTLI_API}/v1/payment-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    })

    if (!qRes.ok) {
      const errText = await qRes.text()
      throw new Error(`Error en Quentli (${qRes.status}): ${errText}`)
    }

    const qData = await qRes.json()
    const sessionId: string = qData.url?.split('/s/')?.[1]?.split('?')?.[0] ?? ''

    return new Response(JSON.stringify({
      ok: true,
      url: qData.url,
      sessionId,
      montoRestante,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
