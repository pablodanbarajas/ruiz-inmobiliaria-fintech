import type { ILotsService } from '../interfaces';
import type { ClientLot } from '../../types/lot.types';
import { mockClientLots } from '../../data/mock/lots.mock';

export const mockLotsService: ILotsService = {
  async getClientLots(_clientId: string): Promise<ClientLot[]> {
    // Mock: devuelve todos los lotes ignorando clientId.
    // La implementación real usará RLS en Supabase para filtrar por usuario.
    return mockClientLots;
  }
};
