/**
 * Tipos canónicos de soporte.
 * SupportTicket: ticket enviado por un cliente o visitante.
 */

export type TicketStatus = 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';

export interface SupportTicket {
  id: string;
  name: string;
  email: string;
  message: string;
  status: TicketStatus;
  createdAt: string;
  /** Si el ticket fue enviado por un cliente autenticado */
  clientId?: string;
}

export interface CreateTicketPayload {
  name: string;
  email: string;
  message: string;
  /** Opcional: si el cliente está autenticado se envía su ID */
  clientId?: string;
}
