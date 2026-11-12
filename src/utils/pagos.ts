/**
 * Utilidades financieras para el registro de pagos.
 *
 * Separa el dinero recibido del saldo a favor utilizado:
 * - montopagado: dinero recibido para la mensualidad (incluye el recargo).
 * - servicios_extra positivo: abono a saldo a favor (dinero que el cliente
 *   deja para usar después en servicios, mensualidades o recargos).
 * - saldo_favor_aplicado: saldo a favor usado para cubrir este pago.
 * - servicios_extra negativo: saldo a favor usado en registros anteriores.
 */
import { supabase } from '@/lib/supabaseClient'

export interface PagoFinanciero {
  montopagado?: number | null
  servicios_extra?: number | null
  saldo_favor_aplicado?: number | null
  estatus?: string | null
}

const redondear = (valor: number): number =>
  Math.round((valor + Number.EPSILON) * 100) / 100

/** Saldo a favor usado por el pago (registros nuevos e históricos). */
export const getSaldoFavorAplicado = (pago: PagoFinanciero): number => {
  if (pago.estatus === 'C') return 0
  const historico = Math.max(0, -Number(pago.servicios_extra ?? 0))
  const nuevo = Math.max(0, Number(pago.saldo_favor_aplicado ?? 0))
  return redondear(historico + nuevo)
}

/** Abono a saldo a favor que dejó el cliente en el pago. */
export const getAbonoSaldoFavor = (pago: PagoFinanciero): number => {
  if (pago.estatus === 'C') return 0
  return redondear(Math.max(0, Number(pago.servicios_extra ?? 0)))
}

/**
 * Importe aplicado a la mensualidad: dinero recibido más saldo a favor usado.
 * No incluye el abono a saldo a favor, que queda para pagos futuros.
 */
export const getPagoAplicado = (pago: PagoFinanciero): number => {
  if (pago.estatus === 'C') return 0
  const recibido = Math.max(0, Number(pago.montopagado ?? 0))
  return redondear(recibido + getSaldoFavorAplicado(pago))
}

/** Saldo a favor que queda: abonos menos lo usado, sin pagos cancelados. */
export const calcularSaldoFavor = (pagos: PagoFinanciero[]): number =>
  redondear(
    Math.max(
      0,
      pagos.reduce((total, p) => total + getAbonoSaldoFavor(p) - getSaldoFavorAplicado(p), 0)
    )
  )

/**
 * Saldo a favor disponible de una venta. Con `hastaPagoId`, el que quedaba
 * justo después de ese pago (para el recibo).
 */
export const fetchSaldoFavorDisponible = async (
  ventaid: number,
  opciones: { hastaPagoId?: number } = {}
): Promise<number> => {
  const { data: corridas, error: corridasError } = await supabase
    .from('corridafinanciera')
    .select('corridafinancieraid')
    .eq('ventaid', ventaid)
  if (corridasError) throw corridasError

  const ids = (corridas ?? []).map((c) => c.corridafinancieraid)
  if (ids.length === 0) return 0

  let query = supabase
    .from('pagos')
    .select('pagoid, servicios_extra, saldo_favor_aplicado, estatus')
    .in('corridafinancieraid', ids)
    .neq('estatus', 'C')
  if (opciones.hastaPagoId != null) query = query.lte('pagoid', opciones.hastaPagoId)

  const { data, error } = await query
  if (error) throw error
  return calcularSaldoFavor(data ?? [])
}

/** Venta a la que pertenece una mensualidad. */
export const fetchVentaDeCorrida = async (corridafinancieraid: number): Promise<number> => {
  const { data, error } = await supabase
    .from('corridafinanciera')
    .select('ventaid')
    .eq('corridafinancieraid', corridafinancieraid)
    .single()
  if (error || !data?.ventaid) throw new Error('No se pudo identificar la venta de la mensualidad.')
  return data.ventaid
}

/**
 * Revisa, justo antes de guardar, que la venta tenga el saldo a favor que se
 * quiere usar. Lanza un error con el disponible si no alcanza.
 */
export const validarSaldoFavorDisponible = async (
  corridafinancieraid: number | null,
  solicitado: number
): Promise<void> => {
  if (!Number.isFinite(solicitado) || solicitado < 0) {
    throw new Error('El saldo a favor aplicado no es válido.')
  }
  if (solicitado === 0) return
  if (!corridafinancieraid) {
    throw new Error('Selecciona una mensualidad para aplicar saldo a favor.')
  }
  const ventaid = await fetchVentaDeCorrida(corridafinancieraid)
  const disponible = await fetchSaldoFavorDisponible(ventaid)
  if (Math.round(solicitado * 100) > Math.round(disponible * 100)) {
    throw new Error(`Saldo a favor insuficiente. Disponible: $${disponible.toFixed(2)}`)
  }
}
