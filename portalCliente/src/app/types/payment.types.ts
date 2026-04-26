/**
 * Tipos canónicos de pagos.
 * Solo accesibles por el cliente autenticado propietario de los lotes.
 *
 * Preparado para integración con Quentli:
 *   - QuentliReference: referencia de cobro generada en Quentli
 *   - QuentliWebhookPayload: payload esperado en el webhook de confirmación
 *     (debe procesarse exclusivamente en backend/edge function, nunca en frontend)
 */

export type PaymentStatus = 'pendiente' | 'atrasado' | 'por_vencer' | 'pagado';

export interface Payment {
  id: string;
  /** Fecha límite o fecha de pago (ISO 8601) */
  date: string;
  reason: string;
  amount: number;
  status: PaymentStatus;
  /** Clave del lote relacionado, ej: "06-042" */
  lotKey?: string;
}

export interface PaymentSummary {
  pendingPayments: Payment[];
  completedPayments: Payment[];
}

// ---------------------------------------------------------------------------
// Tipos de integración con Quentli
// NOTA: la generación de referencias y la validación de webhooks deben
// realizarse en una Edge Function o backend server-side.
// El frontend solo debe consumir el estado final (pagado/pendiente).
// ---------------------------------------------------------------------------

/**
 * Referencia de cobro generada por Quentli.
 * El frontend solo almacena/muestra esta referencia; nunca la genera.
 */
export interface QuentliReference {
  referenceId: string;
  paymentId: string;
  amount: number;
  expiresAt: string;
  paymentUrl: string;
}

/**
 * Estructura esperada del webhook de Quentli.
 * Solo debe ser procesada en backend/edge function.
 * Definida aquí como contrato documentado, no como uso en frontend.
 */
export interface QuentliWebhookPayload {
  event: 'payment.confirmed' | 'payment.failed' | 'payment.expired';
  referenceId: string;
  paymentId: string;
  amount: number;
  confirmedAt: string;
}
