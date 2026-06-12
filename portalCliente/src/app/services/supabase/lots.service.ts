import { supabase } from './client';
import type { ILotsService } from '../interfaces';
import type { ClientLot } from '../../types/lot.types';

type ClientLotRow = {
  user_id: string;
  clienteid: number;
  lot_id: number;
  lot_key: string;
  superficie: number | null;
  preciolote: number | null;
  lot_status: string | null;
  portal_lot_status: string | null;
  development_id: number;
  development_name: string;
  development_description: string;
  ventaid: number;
  sale_status: string | null;
  fechacontrato: string | null;
  enganche: number | null;
  mensualidad: number | null;
  next_due_date: string | null;
  next_payment_amount: number | null;
};

function mapLotStatus(portalStatus: string | null): ClientLot['status'] {
  const value = (portalStatus ?? '').toLowerCase();

  if (value === 'apartado') return 'apartado';
  if (value === 'finalizado') return 'finalizado';
  if (value === 'en_pagos') return 'en_pagos';

  return 'apartado';
}

function mapProgressStage(portalStatus: string | null): number {
  const value = (portalStatus ?? '').toLowerCase();

  if (value === 'apartado') return 1;
  if (value === 'en_pagos') return 3;  // índice 3 = 'Mensualidades' (no llega a 'Liquidado')
  if (value === 'finalizado') return 4; // índice 4 = 'Liquidado'

  return 1;
}

export const supabaseLotsService: ILotsService = {
  async getClientLots(clientId: string): Promise<ClientLot[]> {
    const { data, error } = await supabase
      .from('client_lots')
      .select('*')
      .order('development_name', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener lotes del cliente: ${error.message}`);
    }

    return ((data ?? []) as ClientLotRow[]).map((row) => ({
      id: String(row.lot_id),
      key: row.lot_key,
      developmentName: row.development_name,
      location: 'Ubicación pendiente',
      surface: row.superficie ? `${row.superficie} m²` : 'N/D',
      price: Number(row.preciolote ?? 0),
      image: '',
      status: mapLotStatus(row.portal_lot_status),
      nextPayment: row.next_due_date
        ? {
            amount: Number(row.next_payment_amount ?? row.mensualidad ?? 0),
            dueDate: row.next_due_date,
            type: 'Mensualidad'
          }
        : row.enganche
          ? {
              amount: Number(row.enganche),
              dueDate: row.fechacontrato ?? new Date().toISOString(),
              type: 'Enganche'
            }
          : undefined,
      progress: {
        currentStage: mapProgressStage(row.portal_lot_status),
        stages: ['Solicitud', 'Pago de apartado', 'Enganche', 'Mensualidades', 'Liquidado']
      }
    }));
  }
};