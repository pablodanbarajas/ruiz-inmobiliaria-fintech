import { supabase } from './client';
import type { IPaymentsService } from '../interfaces';
import type { Payment, PaymentSummary, PaymentStatus } from '../../types/payment.types';

type ClientPaymentRow = {
  user_id: string;
  clienteid: number;
  ventaid: number;
  lot_id: number;
  lot_key: string;
  development_id: number;
  development_name: string;
  corridafinancieraid: number;
  nopago: number;
  payment_type: string;
  due_date: string;
  scheduled_amount: number;
  cargo_extra_amount: number;
  recargo_pendiente: number;
  dias_tolerancia: number | null;
  paid_amount: number;
  last_paid_at: string | null;
  recargo_pagado: number;
  moratorio_pagado: number;
  payment_status: 'pagado' | 'pendiente' | 'atrasado';
};

function mapStatus(row: ClientPaymentRow): PaymentStatus {
  if (row.payment_status === 'pagado') return 'pagado';
  if (row.payment_status === 'atrasado') return 'atrasado';

  const due = new Date(row.due_date).getTime();
  const now = new Date().getTime();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays >= 0 && diffDays <= 7) return 'por_vencer';
  return 'pendiente';
}

function toPendingPayment(row: ClientPaymentRow): Payment {
  const base       = Number(row.scheduled_amount ?? 0);
  const cargoExtra = Number(row.cargo_extra_amount ?? 0);
  const recargo    = Number(row.recargo_pendiente ?? 0);
  return {
    id: String(row.corridafinancieraid),
    date: row.due_date,
    reason: `${row.payment_type} · ${row.lot_key}`,
    amount: base + cargoExtra + recargo,
    status: mapStatus(row),
    breakdown: { base, cargoExtra, recargo }
  };
}

function toCompletedPayment(row: ClientPaymentRow): Payment {
  return {
    id: String(row.corridafinancieraid),
    date: row.last_paid_at ?? row.due_date,
    reason: `${row.payment_type} · ${row.lot_key}`,
    amount: Number(row.paid_amount ?? row.scheduled_amount ?? 0),
    status: 'pagado'
  };
}

export const supabasePaymentsService: IPaymentsService = {
  async getClientPayments(clientId: string): Promise<PaymentSummary> {
    const { data, error } = await supabase
      .from('vista_pagos_cliente')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener pagos del cliente: ${error.message}`);
    }

    const rows = (data ?? []) as ClientPaymentRow[];

    const pendingPayments = rows
      .filter((row) => row.payment_status !== 'pagado')
      .map(toPendingPayment);

    const completedPayments = rows
      .filter((row) => row.payment_status === 'pagado')
      .map(toCompletedPayment);

    const nextPayment = pendingPayments.length > 0 ? pendingPayments[0] : null;

    // Obtener todos los corridafinancieraid del cliente de la vista
    const corridaIds = rows.map((row) => row.corridafinancieraid);

    // Calcular saldo pendiente igual que el admin: sum(montopagado + servicios_extra)
    // filtrando por los corridafinancieraid del cliente
    const { data: pagosData, error: pagosError } = await supabase
      .from('pagos')
      .select('montopagado, servicios_extra, estatus')
      .in('corridafinancieraid', corridaIds)
      .neq('estatus', 'C');

    if (pagosError) {
      throw new Error(`Error al obtener pagos: ${pagosError.message}`);
    }

    const totalPagado = (pagosData ?? []).reduce(
      (sum: number, p: any) => sum + ((p.montopagado || 0) + (p.servicios_extra || 0)),
      0
    );

    // El saldo pendiente se calcula: total de venta - pagos aplicados
    // Sum de todos los scheduled_amount - totalPagado
    const totalScheduled = rows.reduce(
      (sum, row) => sum + Number(row.scheduled_amount ?? 0),
      0
    );

    const pendingBalance = Math.max(0, totalScheduled - totalPagado);

    return {
      nextPayment,
      pendingBalance,
      pendingPayments,
      completedPayments
    };
  }
};