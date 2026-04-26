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
  development_id: number;
  development_name: string;
  development_description: string;
  ventaid: number;
  sale_status: string | null;
  fechacontrato: string | null;
  enganche: number | null;
  mensualidad: number | null;
};

function mapLotStatus(status: string | null): ClientLot['status'] {
  const value = (status ?? '').toUpperCase();

  if (value === 'A') return 'apartado';
  if (value === 'V') return 'finalizado';
  if (value === 'D') return 'en_pagos';

  return 'apartado';
}

function mapProgressStage(status: string | null): number {
  const value = (status ?? '').toUpperCase();

  if (value === 'A') return 1;
  if (value === 'D') return 3;
  if (value === 'V') return 5;

  return 1;
}

export const supabaseLotsService: ILotsService = {
  async getClientLots(clientId: string): Promise<ClientLot[]> {
    const { data, error } = await supabase
      .from('client_lots')
      .select('*')
      .eq('user_id', clientId)
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
      status: mapLotStatus(row.lot_status),
      nextPayment: row.enganche
        ? {
            amount: Number(row.enganche),
            dueDate: row.fechacontrato ?? new Date().toISOString(),
            type: 'Enganche'
          }
        : undefined,
      progress: {
        currentStage: mapProgressStage(row.lot_status),
        stages: ['Solicitud', 'Pago de apartado', 'Enganche', 'Mensualidades', 'Liquidado']
      }
    }));
  }
};