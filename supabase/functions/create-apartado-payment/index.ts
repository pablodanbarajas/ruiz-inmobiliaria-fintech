import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const QUENTLI_API = 'https://api.demo.quentli.com'

/**
 * Genera (o regenera) una sesión de pago de Quentli para el apartado de una venta existente.
 * Solo disponible para ventas con estatus='P' (Pendiente — esperando pago de apartado).
 * Guarda el nuevo quentli_apartado_session_id en la venta.
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
    const ventaId = Number(ventaid)
    if (!Number.isInteger(ventaId) || ventaId <= 0) {
      return new Response(JSON.stringify({ error: 'ventaid debe ser un entero válido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (ventaErr || !venta) {
      return new Response(JSON.stringify({ error: 'Venta no encontrada o sin acceso' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (venta.estatus !== 'P') {
      return new Response(JSON.stringify({ error: `La venta no está en estado pendiente de apartado (estatus: ${venta.estatus})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener el desarrollo para saber el monto de apartado
    const { data: loteRow } = await serviceClient
      .from('lote')
      .select('desarrolloid, desarrollo:desarrollo(nombre, montominimoapartado, enganche)')
      .eq('loteid', venta.loteid)
      .single()

    const desarrollo = (loteRow?.desarrollo as any)
    const montoApartado = Number(desarrollo?.montominimoapartado) || 2000

    if (!montoApartado || montoApartado <= 0) {
      return new Response(JSON.stringify({ error: 'El desarrollo no tiene configurado el monto de apartado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('QUENTLI_API_KEY') ?? ''
    const portalUrl = (Deno.env.get('PORTAL_URL') ?? 'https://ruiz-inmobiliaria-fintech.vercel.app/portal')
      .replace(/\/set-password.*$/, '').replace(/\/$/, '')

    const qBody = {
      input: {
        customer: {
          name: cliente.nombre ?? `Cliente ${cliente.clienteid}`,
          externalId: String(cliente.clienteid),
        },
        items: [
          {
            description: `Pago de apartado · ${desarrollo?.nombre ?? ''}`,
            amount: Math.round(montoApartado * 100), // centavos
            quantity: 1,
            currency: 'MXN',
          },
        ],
        metadata: [
          { key: 'ventaid', value: String(ventaid) },
          { key: 'clienteid', value: String(cliente.clienteid) },
          { key: 'type', value: 'apartado' },
        ],
        returnUrl: `${portalUrl}/mis-lotes?apartado_ventaid=${ventaid}`,
      },
    }

    const qRes = await fetch(`${QUENTLI_API}/v1/payment-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(qBody),
    })

    if (!qRes.ok) {
      const errText = await qRes.text()
      throw new Error(`Error en Quentli (${qRes.status}): ${errText}`)
    }

    const qData = await qRes.json()
    const checkoutUrl: string = qData.url ?? ''
    const sessionId: string = checkoutUrl.split('/s/')?.[1]?.split('?')?.[0] ?? ''

    // Guardar el sessionId en la venta para verificarlo al regresar
    await serviceClient
      .from('venta')
      .update({ quentli_apartado_session_id: sessionId })
      .eq('ventaid', ventaId)

    return new Response(JSON.stringify({ url: checkoutUrl, sessionId }), {
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
