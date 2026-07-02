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
  monto_apartado_pagado: number | null;
  fecha_limite_enganche: string | null;
};

function mapLotStatus(portalStatus: string | null): ClientLot['status'] {
  const value = (portalStatus ?? '').toLowerCase();
  if (value === 'en_formalizacion') return 'en_formalizacion';
  if (value === 'apartado_confirmado') return 'apartado_confirmado';
  if (value === 'apartado') return 'apartado';
  if (value === 'finalizado') return 'finalizado';
  if (value === 'en_pagos') return 'en_pagos';
  return 'apartado';
}

function mapProgressStage(portalStatus: string | null): number {
  const value = (portalStatus ?? '').toLowerCase();
  if (value === 'apartado') return 1;
  if (value === 'apartado_confirmado') return 2;
  if (value === 'en_formalizacion') return 3; // Enganche pagado, admin configura mensualidades
  if (value === 'en_pagos') return 3;
  if (value === 'finalizado') return 4;
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
      ventaid: String(row.ventaid),
      developmentId: String(row.development_id),
      key: row.lot_key,
      developmentName: row.development_name,
      location: 'Ubicación pendiente',
      surface: row.superficie ? `${row.superficie} m²` : 'N/D',
      price: Number(row.preciolote ?? 0),
      image: '',
      status: mapLotStatus(row.portal_lot_status),
      nextPayment: (() => {
        // Lote en fase de enganche: mostrar monto restante y fecha limite
        if (row.portal_lot_status === 'apartado_confirmado' && row.fecha_limite_enganche) {
          const engancheTotal = Number(row.enganche ?? 0);
          const apartadoPagado = Number(row.monto_apartado_pagado ?? 0);
          return {
            amount: Math.max(0, engancheTotal - apartadoPagado),
            dueDate: row.fecha_limite_enganche,
            type: 'Enganche'
          };
        }
        // Lote en formalizacion (enganche pagado, admin configura mensualidades)
        if (row.portal_lot_status === 'en_formalizacion') {
          return undefined; // Sin próximo pago hasta que admin active la corrida
        }
        // Lote en mensualidades
        if (row.next_due_date) {
          return { amount: Number(row.next_payment_amount ?? row.mensualidad ?? 0), dueDate: row.next_due_date, type: 'Mensualidad' };
        }
        // Lote apartado (reserva pendiente)
        if (row.portal_lot_status === 'apartado') {
          return { amount: Number(row.enganche ?? 0), dueDate: '', type: 'Apartado' };
        }
        return undefined;
      })(),
      progress: {
        currentStage: mapProgressStage(row.portal_lot_status),
        stages: ['Solicitud', 'Pago de apartado', 'Enganche', 'Mensualidades', 'Liquidado']
      }
    }));
  }
};