import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Webhook para recibir eventos de Quentli (INVOICE_PAID, INVOICE_PAID_OTHER)
 * y registrar automáticamente pagos en la tabla `pago` de Supabase.
 * 
 * SEGURIDAD: Valida firma HMAC-SHA256 de Quentli en cada solicitud
 * Header esperado: X-Quentli-Signature (HMAC-SHA256 del body)
 */

/**
 * Verifica la firma HMAC-SHA256 del webhook de Quentli
 */
async function verifyQuentliSignature(
  bodyText: string,
  receivedSignature: string,
  secret: string
): Promise<boolean> {
  try {
    // Crear HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Decodificar firma (esperada en hexadecimal)
    const signatureBytes = new Uint8Array(
      receivedSignature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
    )

    const bodyBytes = new TextEncoder().encode(bodyText)

    // Verificar firma
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, bodyBytes)

    return isValid
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Leer el body como texto (necesario antes de cualquier validación de firma)
  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. VALIDACIÓN DE SEGURIDAD: Verificar firma HMAC si el secreto está configurado
  // Sin secreto → modo demo (Quentli demo no expone signing secret)
  // Con secreto → producción, la firma es obligatoria
  const quentliSecret = Deno.env.get('QUENTLI_WEBHOOK_SECRET') ?? ''

  if (quentliSecret) {
    const receivedSignature = req.headers.get('X-Quentli-Signature') ?? ''
    if (!receivedSignature) {
      return new Response(JSON.stringify({ error: 'Missing signature header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const isSignatureValid = await verifyQuentliSignature(bodyText, receivedSignature, quentliSecret)
    if (!isSignatureValid) {
      console.error('Invalid webhook signature', { signature: receivedSignature.substring(0, 10) + '...' })
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } else {
    console.warn('QUENTLI_WEBHOOK_SECRET not set — running without signature validation (demo mode)')
  }

  // 3. Parsear el JSON
  let body: any
  try {
    body = JSON.parse(bodyText)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { eventType, data } = body

  // Solo procesar eventos de pago
  if (eventType !== 'INVOICE_PAID' && eventType !== 'INVOICE_PAID_OTHER') {
    return new Response(JSON.stringify({ ok: true, skipped: true, eventType }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Extraer datos del evento
  const clienteid = parseInt(data?.customer?.username ?? '', 10)
  const amountCentavos: number = data?.amount ?? 0
  const montopagado = amountCentavos / 100
  const invoiceId: string = data?.invoiceId ?? ''
  const paymentType: string = data?.payment?.type ?? 'OTHER'

  // Extraer corridafinancieraid del metadata (presente cuando el pago vino de "Pagar ahora")
  const metadataList: Array<{ key: string; value: string }> = data?.metadata ?? []
  const metadataMap = Object.fromEntries(metadataList.map((m: { key: string; value: string }) => [m.key, m.value]))
  const corridaFromMetadata = metadataMap['corridafinancieraid']
    ? parseInt(metadataMap['corridafinancieraid'], 10)
    : null

  if (!clienteid || isNaN(clienteid) || montopagado <= 0) {
    return new Response(
      JSON.stringify({ error: 'Datos insuficientes: se requiere customer.username y amount' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // formapago: 4=Tarjeta, 2=Transferencia, 1=Efectivo
  const formapago = paymentType === 'CARD' ? 4 : paymentType === 'TRANSFER' ? 2 : 1

  // ── RUTA 1: corridafinancieraid viene en metadata (pago desde "Pagar ahora") ──
  if (corridaFromMetadata && !isNaN(corridaFromMetadata)) {
    // Verificar que la corrida no tenga ya un pago registrado (idempotencia)
    const { data: pagoExistente } = await supabase
      .from('pagos')
      .select('pagoid')
      .eq('corridafinancieraid', corridaFromMetadata)
      .eq('estatus', 'P')
      .maybeSingle()

    if (pagoExistente) {
      return new Response(
        JSON.stringify({ ok: true, message: 'Pago ya registrado anteriormente', corridaFromMetadata }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { data: corridaData } = await supabase
      .from('corridafinanciera')
      .select('corridafinancieraid, nopago, ventaid')
      .eq('corridafinancieraid', corridaFromMetadata)
      .single()

    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        corridafinancieraid: corridaFromMetadata,
        fechapago: new Date().toISOString().split('T')[0],
        montopagado,
        formapago,
        estatus: 'P',
        referencia: invoiceId,
        comentario: `Pago registrado automáticamente desde Quentli (${eventType})`,
      })
      .select()
      .single()

    if (pagoError) {
      return new Response(
        JSON.stringify({ error: `Error al insertar pago: ${pagoError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        pagoid: pago.pagoid,
        nopago: corridaData?.nopago,
        ventaid: corridaData?.ventaid,
        montopagado,
        source: 'metadata',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── RUTA 2: Pago de suscripción — buscar por cliente y monto ──
  // 1. Buscar venta activa del cliente que coincida con el monto
  const { data: ventas, error: ventaError } = await supabase
    .from('venta')
    .select('ventaid, mensualidad')
    .eq('clienteid', clienteid)
    .eq('estatus', 'A')

  if (ventaError || !ventas || ventas.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No se encontró venta activa', clienteid }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Priorizar la venta cuya mensualidad coincide con el monto pagado
  const venta =
    ventas.find((v) => Math.abs((v.mensualidad ?? 0) - montopagado) < 1) ?? ventas[0]

  // 2. Obtener corridas financieras pendientes de pago (nopago > 0)
  const { data: corridas, error: corridaError } = await supabase
    .from('corridafinanciera')
    .select('corridafinancieraid, nopago, fecha, mensualidad')
    .eq('ventaid', venta.ventaid)
    .gt('nopago', 0)
    .order('nopago', { ascending: true })

  if (corridaError || !corridas) {
    return new Response(
      JSON.stringify({ error: 'Error al obtener corrida financiera', ventaid: venta.ventaid }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Obtener IDs de corridas que ya tienen pago registrado
  const corridaIds = corridas.map((c) => c.corridafinancieraid)
  const { data: pagosExistentes } = await supabase
    .from('pagos')
    .select('corridafinancieraid')
    .in('corridafinancieraid', corridaIds)
    .eq('estatus', 'P')

  const corridasConPago = new Set((pagosExistentes ?? []).map((p) => p.corridafinancieraid))

  // 4. Encontrar la primera mensualidad sin pago registrado
  const unpaid = corridas.find((c) => !corridasConPago.has(c.corridafinancieraid))

  if (!unpaid) {
    return new Response(
      JSON.stringify({ ok: true, message: 'Todos los pagos ya están registrados', ventaid: venta.ventaid }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      corridafinancieraid: unpaid.corridafinancieraid,
      fechapago: new Date().toISOString().split('T')[0],
      montopagado,
      formapago,
      estatus: 'P',
      referencia: invoiceId,
      comentario: `Pago registrado automáticamente desde Quentli (${eventType})`,
    })
    .select()
    .single()

  if (pagoError) {
    return new Response(
      JSON.stringify({ error: `Error al insertar pago: ${pagoError.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      ok: true,
      pagoid: pago.pagoid,
      nopago: unpaid.nopago,
      ventaid: venta.ventaid,
      montopagado,
      source: 'subscription',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
