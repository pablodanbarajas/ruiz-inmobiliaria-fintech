
/**
 * Utilidades financieras para el registro de pagos.
 *
 * Separa el dinero recibido del saldo a favor
 * utilizado para liquidar obligaciones.
 */

export interface PagoFinanciero {
  montopagado?: number | null
  servicios_extra?: number | null
  saldo_favor_aplicado?: number | null
  estatus?: string | null
}

const redondear = (valor: number): number =>
  Math.round((valor + Number.EPSILON) * 100) / 100

/**
 * Obtiene el saldo a favor consumido.
 *
 * Compatibilidad:
 * - Registros antiguos: servicios_extra negativo.
 * - Registros nuevos: saldo_favor_aplicado positivo.
 */
export const getSaldoFavorAplicado = (
  pago: PagoFinanciero
): number => {
  if (pago.estatus === 'C') return 0

  const historico = Math.max(
    0,
    -Number(pago.servicios_extra ?? 0)
  )

  const nuevo = Math.max(
    0,
    Number(pago.saldo_favor_aplicado ?? 0)
  )

  return redondear(historico + nuevo)
}

/**
 * Calcula el importe aplicado a una obligación.
 *
 * Incluye:
 * - Dinero destinado a cubrir la obligación.
 * - Saldo a favor utilizado en registros históricos.
 * - Saldo a favor utilizado mediante el campo nuevo.
 *
 * No incluye abonos positivos destinados a generar
 * saldo a favor para pagos futuros.
 */
export const getPagoAplicado = (
  pago: PagoFinanciero
): number => {
  if (pago.estatus === 'C') return 0

  const recibido = Math.max(
    0,
    Number(pago.montopagado ?? 0)
  )

  const saldoHistorico = Math.max(
    0,
    -Number(pago.servicios_extra ?? 0)
  )

  const saldoNuevo = Math.max(
    0,
    Number(pago.saldo_favor_aplicado ?? 0)
  )

  return redondear(
    recibido + saldoHistorico + saldoNuevo
  )
}
/**
 * Calcula cuánto falta por liquidar.
 */
export const calcularPendiente = (
  totalRequerido: number,
  pagosAplicados: number
): number => {
  return redondear(
    Math.max(0, totalRequerido - pagosAplicados)
  )
}

/**
 * Determina si una obligación quedó cubierta.
 */
export const estaLiquidado = (
  totalRequerido: number,
  pagosAplicados: number
): boolean => {
  return calcularPendiente(
    totalRequerido,
    pagosAplicados
  ) === 0
}
