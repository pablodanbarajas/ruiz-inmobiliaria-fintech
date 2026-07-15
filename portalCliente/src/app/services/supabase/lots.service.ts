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

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

    const rows = (data ?? []) as ClientLotRow[];
    const developmentIds = Array.from(new Set(rows.map((row) => row.development_id)));
    const ventaIds = rows.map((row) => row.ventaid);

    const { data: developmentsData } = await supabase
      .from('desarrollo')
      .select('desarrolloid, montominimoapartado')
      .in('desarrolloid', developmentIds);

    const minApartadoByDevelopment = new Map<number, number>(
      ((developmentsData as any[]) ?? []).map((d) => [
        toNumber(d.desarrolloid, 0),
        toNumber(d.montominimoapartado, 2000),
      ])
    );

    const { data: ventasData } = await supabase
      .from('venta')
      .select('ventaid, fecha_reserva')
      .in('ventaid', ventaIds);

    const fechaReservaByVenta = new Map<number, string>(
      ((ventasData as any[]) ?? [])
        .filter((v) => v?.ventaid)
        .map((v) => [toNumber(v.ventaid, 0), String(v.fecha_reserva ?? '')])
    );

    return rows.map((row) => ({
      id: String(row.lot_id),
      ventaid: String(row.ventaid),
      developmentId: String(row.development_id),
      key: row.lot_key,
      developmentName: row.development_name,
      location: 'Ubicación pendiente',
      surface: row.superficie ? `${row.superficie} m²` : 'N/D',
      price: toNumber(row.preciolote, 0),
      imageUrl: '',
      status: mapLotStatus(row.portal_lot_status),
      nextPayment: (() => {
        // Lote en fase de enganche: mostrar monto restante y fecha limite
        if (row.portal_lot_status === 'apartado_confirmado' && row.fecha_limite_enganche) {
          const engancheTotal = toNumber(row.enganche, 0);
          const apartadoPagado = toNumber(row.monto_apartado_pagado, 0);
          return {
            amount: Math.max(0, engancheTotal - apartadoPagado),
            dueDate: row.fecha_limite_enganche,
            paymentType: 'Enganche'
          };
        }
        // Lote en formalizacion (enganche pagado, admin configura mensualidades)
        if (row.portal_lot_status === 'en_formalizacion') {
          return undefined; // Sin próximo pago hasta que admin active la corrida
        }
        // Lote en mensualidades
        if (row.next_due_date) {
          return {
            amount: toNumber(row.next_payment_amount ?? row.mensualidad, 0),
            dueDate: row.next_due_date,
            paymentType: 'Mensualidad'
          };
        }
        // Lote apartado (reserva pendiente)
        if (row.portal_lot_status === 'apartado') {
          const reservaRaw = fechaReservaByVenta.get(row.ventaid) ?? '';
          const reservaDate = reservaRaw ? new Date(reservaRaw) : null;
          const hasReservaValida = Boolean(reservaDate && !Number.isNaN(reservaDate.getTime()));
          const dueDate = hasReservaValida
            ? new Date(reservaDate!.getTime() + (24 * 60 * 60 * 1000)).toISOString()
            : '';

          return {
            amount: toNumber(minApartadoByDevelopment.get(row.development_id), 2000),
            dueDate,
            paymentType: 'Apartado'
          };
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