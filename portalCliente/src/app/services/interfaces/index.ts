/**
 * Contratos de servicios del portal cliente.
 * Cada interfaz define el comportamiento esperado.
 * Las implementaciones (mock, supabase) deben cumplir este contrato.
 *
 * Patrón usado: Service Interface + múltiples implementaciones.
 * El consumidor (componente/página) solo conoce la interfaz.
 */

import type { AuthSession, LoginCredentials, RegisterCredentials } from '../types/auth.types';
import type { PublicDevelopment } from '../types/development.types';
import type { ClientLot } from '../types/lot.types';
import type { PaymentSummary } from '../types/payment.types';
import type { CreateTicketPayload, SupportTicket } from '../types/support.types';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface IAuthService {
  /** Devuelve la sesión activa, o sesión vacía si no hay usuario */
  getSession(): AuthSession;
  /** Inicia sesión con email y contraseña */
  login(credentials: LoginCredentials): Promise<AuthSession>;
  /** Registra un nuevo cliente */
  register(credentials: RegisterCredentials): Promise<AuthSession>;
  /** Cierra la sesión activa */
  logout(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Desarrollos
// ---------------------------------------------------------------------------

export interface IDevelopmentsService {
  /** Desarrollos visibles para cualquier visitante */
  getPublicDevelopments(): Promise<PublicDevelopment[]>;
}

// ---------------------------------------------------------------------------
// Lotes
// ---------------------------------------------------------------------------

export interface ILotsService {
  /**
   * Lotes asignados al cliente autenticado.
   * @param clientId  ID del cliente; la implementación real usará RLS en Supabase
   */
  getClientLots(clientId: string): Promise<ClientLot[]>;
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

export interface IPaymentsService {
  /**
   * Pagos pendientes y completados del cliente.
   * @param clientId  ID del cliente; la implementación real usará RLS en Supabase
   */
  getClientPayments(clientId: string): Promise<PaymentSummary>;
}

// ---------------------------------------------------------------------------
// Soporte
// ---------------------------------------------------------------------------

export interface ISupportService {
  /** Envía un ticket de soporte */
  createTicket(payload: CreateTicketPayload): Promise<SupportTicket>;
}
