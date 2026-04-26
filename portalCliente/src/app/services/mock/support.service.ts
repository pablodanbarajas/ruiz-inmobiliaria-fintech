import type { ISupportService } from '../interfaces';
import type { CreateTicketPayload, SupportTicket } from '../../types/support.types';

export const mockSupportService: ISupportService = {
  async createTicket(payload: CreateTicketPayload): Promise<SupportTicket> {
    return {
      id: `ticket-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      message: payload.message,
      status: 'abierto',
      createdAt: new Date().toISOString(),
      clientId: payload.clientId
    };
  }
};
