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

// Helper: calcular recargo por días de atraso
function calcularRecargo(fechaVencimiento: string, diasTolerancia: number = 3): number {
  const vencimiento = new Date(fechaVencimiento);
  const hoy = new Date();
  const diasAtraso = Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diasAtraso <= diasTolerancia) return 0;
  
  const diasMora = diasAtraso - diasTolerancia;
  return diasMora * 50; // $50 por día de atraso
}

export const supabasePaymentsService: IPaymentsService = {
  async getClientPayments(clientId: string): Promise<PaymentSummary> {
    // 1. Obtener todas las ventas del cliente (activas)
    const { data: ventasData, error: ventasError } = await supabase
      .from('venta')
      .select('ventaid, preciolote, estatus, loteid, dias_tolerancia')
      .eq('clienteid', Number(clientId))
      .in('estatus', ['A', 'V']);

    if (ventasError) {
      throw new Error(`Error al obtener ventas: ${ventasError.message}`);
    }

    const ventas = (ventasData ?? []) as any[];
    const ventaIds = new Set(ventas.map((v) => v.ventaid));
    const totalPrecio = ventas.reduce((sum, v) => sum + (v.preciolote || 0), 0);

    // 2. Obtener todas las corridas de esas ventas
    const { data: corridasData, error: corridasError } = await supabase
      .from('corridafinanciera')
      .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad')
      .in('ventaid', Array.from(ventaIds))
      .order('fecha', { ascending: true });

    if (corridasError) {
      throw new Error(`Error al obtener corridas: ${corridasError.message}`);
    }

    const corridas = (corridasData ?? []) as any[];

    // 3. Obtener todos los pagos de esas corridas
    const corridaIds = corridas.map((c) => c.corridafinancieraid);
    const { data: pagosData, error: pagosError } = await supabase
      .from('pagos')
      .select('pagoid, corridafinancieraid, montopagado, servicios_extra, estatus, fechapago')
      .in('corridafinancieraid', corridaIds)
      .neq('estatus', 'C');

    if (pagosError) {
      throw new Error(`Error al obtener pagos: ${pagosError.message}`);
    }

    const pagos = (pagosData ?? []) as any[];
    const totalPagado = pagos.reduce(
      (sum, p) => sum + ((p.montopagado || 0) + (p.servicios_extra || 0)),
      0
    );

    // 4. Obtener cargos_extra para todos los lotes
    const loteIds = ventas.map((v) => v.loteid);
    const { data: cargosData, error: cargosError } = await supabase
      .from('cargos_extra')
      .select('cargoid, loteid, monto, estatus, fecha')
      .in('loteid', loteIds)
      .neq('estatus', 'X');

    if (cargosError) {
      throw new Error(`Error al obtener cargos: ${cargosError.message}`);
    }

    const cargosExtra = (cargosData ?? []) as any[];

    // 5. Obtener lote y desarrollo para cada venta
    const { data: loteDesarrolloData, error: ldError } = await supabase
      .from('lote')
      .select('loteid, clavelote, manzana, nolote, desarrolloid, desarrollo(nombre)')
      .in('loteid', loteIds);

    if (ldError) {
      throw new Error(`Error al obtener lotes: ${ldError.message}`);
    }

    const lotesMap = new Map(
      ((loteDesarrolloData as any) ?? []).map((l: any) => [
        l.loteid,
        {
          clavelote: l.clavelote,
          manzana: l.manzana,
          nolote: l.nolote,
          desarrolloid: l.desarrolloid,
          development_name: l.desarrollo?.nombre || 'N/A',
        },
      ])
    );

    // 6. Construir payment rows desde corridas
    const rows: ClientPaymentRow[] = corridas.map((corrida) => {
      const venta = ventas.find((v) => v.ventaid === corrida.ventaid);
      const lote = lotesMap.get(venta?.loteid);
      
      const lot_key = lote?.clavelote || `Mza-${lote?.manzana}-Lote-${lote?.nolote}`;
      
      // Pagos de esta corrida
      const corridaPagos = pagos.filter((p) => p.corridafinancieraid === corrida.corridafinancieraid);
      const totalPagadoCorrida = corridaPagos.reduce(
        (sum, p) => sum + ((p.montopagado || 0) + (p.servicios_extra || 0)),
        0
      );
      const lastPago = corridaPagos.sort((a, b) => 
        new Date(b.fechapago || '').getTime() - new Date(a.fechapago || '').getTime()
      )[0];

      // Cargos extra aplicables: SOLO si nopago !== 0 y fecha del cargo <= fecha corrida
      const cargosAplicables = corrida.nopago !== 0
        ? cargosExtra.filter(
            (c) => c.loteid === venta?.loteid && c.fecha && corrida.fecha && c.fecha <= corrida.fecha
          )
        : [];
      const cargoExtraAmount = cargosAplicables.reduce((sum, c) => sum + (c.monto || 0), 0);

      // Recargo
      const recargo = totalPagadoCorrida === 0 && corrida.fecha
        ? calcularRecargo(corrida.fecha, venta?.dias_tolerancia ?? 3)
        : 0;

      // Payment status
      let payment_status: 'pagado' | 'pendiente' | 'atrasado' = 'pendiente';
      if (totalPagadoCorrida > 0) {
        payment_status = 'pagado';
      } else if (new Date(corrida.fecha) < new Date()) {
        payment_status = 'atrasado';
      }

      return {
        user_id: '',
        clienteid: Number(clientId),
        ventaid: corrida.ventaid,
        lot_id: venta?.loteid || 0,
        lot_key,
        development_id: lote?.desarrolloid || 0,
        development_name: lote?.development_name || 'N/A',
        corridafinancieraid: corrida.corridafinancieraid,
        nopago: corrida.nopago,
        payment_type: 'Mensualidad',
        due_date: corrida.fecha,
        scheduled_amount: corrida.mensualidad || 0,
        cargo_extra_amount: cargoExtraAmount,
        recargo_pendiente: recargo,
        dias_tolerancia: venta?.dias_tolerancia || 3,
        paid_amount: totalPagadoCorrida,
        last_paid_at: lastPago?.fechapago || null,
        recargo_pagado: 0,
        moratorio_pagado: 0,
        payment_status,
      } as ClientPaymentRow;
    });

    const pendingPayments = rows
      .filter((row) => row.payment_status !== 'pagado')
      .map(toPendingPayment);

    const completedPayments = rows
      .filter((row) => row.payment_status === 'pagado')
      .map(toCompletedPayment);

    const nextPayment = pendingPayments.length > 0 ? pendingPayments[0] : null;

    // Calcular cargos_extra únicos por lote (suma solo una vez por lote de los pendientes)
    const uniqueLotes = new Set(ventas.map((v) => v.loteid));
    const totalCargosExtras = Array.from(uniqueLotes).reduce((sum, lotId) => {
      const loteCargos = cargosExtra.filter((c) => c.loteid === lotId);
      return sum + loteCargos.reduce((s, c) => s + (c.monto || 0), 0);
    }, 0);

    // Calcular recargos totales
    const totalRecargos = pendingPayments.reduce(
      (sum, p) => sum + (p.breakdown?.recargo || 0),
      0
    );

    // Saldo pendiente = preciolote - pagado (SIN incluir cargos ni recargos)
    const pendingBalance = Math.max(0, totalPrecio - totalPagado);

    return {
      nextPayment,
      pendingBalance,
      pendingPayments,
      completedPayments
    };
  }
};