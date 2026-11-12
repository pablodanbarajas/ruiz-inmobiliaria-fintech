import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecretKey } from '../_shared/keys.ts'

/**
 * Receives Quentli payment events (INVOICE_PAID, INVOICE_PAID_OTHER) and
 * records the payment in `pagos`.
 *
 * Quentli calls this without a Supabase JWT, so the gateway check is off
 * (config.toml: verify_jwt = false). The demo environment has no signing
 * secret either, so the event body is never trusted: the invoice is read back
 * from the Quentli API with our key, and only an invoice Quentli reports as
 * paid is recorded, with the amount Quentli reports. A forged event can't
 * create a payment. When QUENTLI_WEBHOOK_SECRET is set, the HMAC signature is
 * required as well.
 */

const QUENTLI_API = Deno.env.get('QUENTLI_API_URL') ?? 'https://api.demo.quentli.com'
const UNIQUE_VIOLATION = '23505'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function verifyQuentliSignature(bodyText: string, receivedSignature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const signatureBytes = new Uint8Array(
      receivedSignature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    )
    return await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(bodyText))
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

/** Quentli returns metadata as a list of {key, value} or as a plain map. */
const readMetadata = (source: unknown): Record<string, string> => {
  if (Array.isArray(source)) {
    return Object.fromEntries(source.map((entry: { key: string; value: string }) => [entry.key, entry.value]))
  }
  return source && typeof source === 'object' ? (source as Record<string, string>) : {}
}

const toPositiveInt = (value: unknown): number | null => {
  const parsed = parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const signingSecret = Deno.env.get('QUENTLI_WEBHOOK_SECRET') ?? ''
  if (signingSecret) {
    const signature = req.headers.get('X-Quentli-Signature') ?? ''
    if (!signature || !(await verifyQuentliSignature(bodyText, signature, signingSecret))) {
      return json({ error: 'Invalid signature' }, 401)
    }
  }

  let body: any
  try {
    body = JSON.parse(bodyText)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { eventType, data } = body ?? {}
  if (eventType !== 'INVOICE_PAID' && eventType !== 'INVOICE_PAID_OTHER') {
    return json({ ok: true, skipped: true, eventType })
  }

  const invoiceId: string = String(data?.invoiceId ?? data?.invoice?.id ?? '')
  if (!invoiceId.startsWith('inv_')) return json({ error: 'invoiceId missing' }, 400)

  // ── Read the invoice from Quentli: the only source we trust ──
  const qHeaders = {
    Authorization: `Bearer ${Deno.env.get('QUENTLI_API_KEY') ?? ''}`,
    'Content-Type': 'application/json',
  }
  const invoiceRes = await fetch(`${QUENTLI_API}/v1/invoices/${encodeURIComponent(invoiceId)}`, { headers: qHeaders })
  if (invoiceRes.status === 404) return json({ error: 'Invoice not found in Quentli' }, 404)
  if (!invoiceRes.ok) {
    // 5xx makes Quentli retry the event later.
    console.error(`Quentli invoice lookup failed (${invoiceRes.status}) for ${invoiceId}`)
    return json({ error: 'Could not read the invoice from Quentli' }, 502)
  }
  const invoiceJson = await invoiceRes.json()
  const invoice = invoiceJson?.invoice ?? invoiceJson

  if (!invoice?.isPaid) {
    console.warn(`Event ${eventType} for ${invoiceId}, but Quentli reports it unpaid; ignored`)
    return json({ ok: false, error: 'Invoice is not paid in Quentli' }, 409)
  }

  const montopagado = Number(invoice.amountPaid ?? invoice.totalAmount ?? 0) / 100
  if (!(montopagado > 0)) return json({ error: 'Paid amount missing in Quentli' }, 422)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    getSecretKey(),
  )

  // ── Already recorded? One payment per invoice (portal or webhook) ──
  const { data: existing, error: existingError } = await supabase
    .from('pagos')
    .select('pagoid')
    .eq('referencia', invoiceId)
    .neq('estatus', 'C')
    .limit(1)
  if (existingError) return json({ error: existingError.message }, 500)
  if (existing && existing.length > 0) {
    return json({ ok: true, alreadyRegistered: true, pagoid: existing[0].pagoid })
  }

  // ── Which installment: the one we created this invoice for ──
  const { data: linkedCorrida } = await supabase
    .from('corridafinanciera')
    .select('corridafinancieraid')
    .eq('quentli_invoice_id', invoiceId)
    .maybeSingle()

  let corridafinancieraid: number | null = linkedCorrida?.corridafinancieraid ?? null
  if (!corridafinancieraid) {
    corridafinancieraid = toPositiveInt(readMetadata(invoice.meta ?? invoice.metadata)['corridafinancieraid'])
  }

  // Subscription charges carry no installment: use the oldest unpaid one of that sale.
  let source = 'invoice'
  if (!corridafinancieraid) {
    const subscriptionId = invoice.subscriptionId ?? invoice.subscription?.id ?? data?.subscriptionId ?? null
    if (!subscriptionId) {
      console.error(`Paid invoice ${invoiceId} has no installment or subscription`)
      return json({ error: 'Could not identify the installment for this invoice' }, 422)
    }

    const { data: venta } = await supabase
      .from('venta')
      .select('ventaid')
      .eq('quentli_subscription_id', subscriptionId)
      .maybeSingle()
    if (!venta) return json({ error: 'subscriptionId not registered', subscriptionId }, 422)

    const { data: corridas, error: corridasError } = await supabase
      .from('corridafinanciera')
      .select('corridafinancieraid, pagos:pagos(pagoid, estatus)')
      .eq('ventaid', venta.ventaid)
      .gt('nopago', 0)
      .order('nopago', { ascending: true })
    if (corridasError || !corridas) return json({ error: 'Could not read the payment schedule' }, 500)

    const unpaid = corridas.find((corrida: any) => !(corrida.pagos ?? []).some((pago: any) => pago.estatus === 'P'))
    if (!unpaid) return json({ ok: true, message: 'Every installment is already paid', ventaid: venta.ventaid })
    corridafinancieraid = unpaid.corridafinancieraid
    source = 'subscription'
  }

  const paymentType = String(invoice.payment?.type ?? data?.payment?.type ?? 'CARD')
  // formapago: 4 = tarjeta, 2 = transferencia, 1 = efectivo
  const formapago = paymentType === 'TRANSFER' ? 2 : paymentType === 'CASH' ? 1 : 4

  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      corridafinancieraid,
      fechapago: new Date().toISOString().split('T')[0],
      montopagado,
      formapago,
      estatus: 'P',
      referencia: invoiceId,
      comentario: `Pago registrado automáticamente desde Quentli (${eventType})`,
    })
    .select('pagoid')
    .single()

  if (pagoError) {
    // The portal recorded the same invoice a moment earlier.
    if (pagoError.code === UNIQUE_VIOLATION) return json({ ok: true, alreadyRegistered: true })
    return json({ error: `Error al insertar pago: ${pagoError.message}` }, 500)
  }

  return json({ ok: true, pagoid: pago.pagoid, corridafinancieraid, montopagado, source })
})
