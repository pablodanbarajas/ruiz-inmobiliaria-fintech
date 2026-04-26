import { supabase } from './client';
import type { ISupportService } from '../interfaces';
import type { CreateTicketPayload, SupportTicket } from '../../types/support.types';

export const supabaseSupportService: ISupportService = {
  async createTicket(payload: CreateTicketPayload): Promise<SupportTicket> {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const { error } = await supabase
      .from('soporte_ticket')
      .insert({
        user_id: session?.user?.id ?? null,
        nombre: payload.name,
        email: payload.email,
        mensaje: payload.message,
        estatus: 'nuevo',
        origen: 'portal_cliente'
      });

    if (error) {
      throw new Error(`Error al crear ticket de soporte: ${error.message}`);
    }

    return {
      id: crypto.randomUUID(),
      name: payload.name,
      email: payload.email,
      message: payload.message,
      status: 'nuevo',
      createdAt: new Date().toISOString()
    };
  }
};