import { supabase } from './client';
import type { IPaymentsService } from '../interfaces';
import type { Payment, PaymentSummary, PaymentStatus, LoteSummary } from '../../types/payment.types';

// Helper: calcular recargo igual que el admin (calcularRecargo en helpers.ts)
function calcularRecargo(fechaVencimiento: string, diasTolerancia: number = 3): number {
  const vencimiento = new Date(fechaVencimiento + 'T12:00:00');
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
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

    if (ventasError) throw new Error(`Error al obtener ventas: ${ventasError.message}`);

    const ventas = (ventasData ?? []) as any[];
    const ventaIds = ventas.map((v) => v.ventaid);
    const loteIds = ventas.map((v) => v.loteid);

    // 2. Obtener todas las corridas de esas ventas
    const { data: corridasData, error: corridasError } = await supabase
      .from('corridafinanciera')
      .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad')
      .in('ventaid', ventaIds)
      .order('fecha', { ascending: true });

    if (corridasError) throw new Error(`Error al obtener corridas: ${corridasError.message}`);
    const corridas = (corridasData ?? []) as any[];

    // 3. Obtener todos los pagos de esas corridas (no cancelados)
    const corridaIds = corridas.map((c) => c.corridafinancieraid);
    const { data: pagosData, error: pagosError } = await supabase
      .from('pagos')
      .select('pagoid, corridafinancieraid, montopagado, servicios_extra, estatus, fechapago')
      .in('corridafinancieraid', corridaIds)
      .neq('estatus', 'C');

    if (pagosError) throw new Error(`Error al obtener pagos: ${pagosError.message}`);
    const pagos = (pagosData ?? []) as any[];

    // 4. Obtener cargos_extra para todos los lotes (excluir solo 'X' = error administrativo)
    const { data: cargosData, error: cargosError } = await supabase
      .from('cargos_extra')
      .select('cargoid, loteid, monto, estatus, fecha')
      .in('loteid', loteIds)
      .neq('estatus', 'X');

    if (cargosError) throw new Error(`Error al obtener cargos: ${cargosError.message}`);
    const cargosExtra = (cargosData ?? []) as any[];

    // 5. Obtener info de lote y desarrollo
    const { data: lotesData, error: ldError } = await supabase
      .from('lote')
      .select('loteid, clavelote, manzana, nolote, desarrolloid, desarrollo(nombre)')
      .in('loteid', loteIds);

    if (ldError) throw new Error(`Error al obtener lotes: ${ldError.message}`);

    const lotesMap = new Map(
      ((lotesData as any) ?? []).map((l: any) => [
        l.loteid,
        {
          clavelote: l.clavelote,
          manzana: l.manzana,
          nolote: l.nolote,
          desarrolloid: l.desarrolloid,
          developmentName: l.desarrollo?.nombre || 'N/A',
        },
      ])
    );

    // 6. Construir resumen por lote (igual que admin)
    const loteSummaries: LoteSummary[] = ventas.map((venta) => {
      const lote = lotesMap.get(venta.loteid);
      const lotKey = lote?.clavelote || `Mza-${lote?.manzana}-Lote-${lote?.nolote}`;
      const ventaCorridas = corridas.filter((c) => c.ventaid === venta.ventaid);
      const loteCargos = cargosExtra.filter((c) => c.loteid === venta.loteid);

      // Pagos de este lote (misma lógica que admin: suma montopagado + servicios_extra)
      const ventaCorridaIds = new Set(ventaCorridas.map((c) => c.corridafinancieraid));
      const ventaPagos = pagos.filter((p) => ventaCorridaIds.has(p.corridafinancieraid));
      const totalPagado = ventaPagos.reduce(
        (sum, p) => sum + ((p.montopagado || 0) + (p.servicios_extra || 0)),
        0
      );

      // Saldo del lote = preciolote - totalPagado (igual a admin "Deuda del Lote")
      const saldoLote = Math.max(0, (venta.preciolote || 0) - totalPagado);

      // Pagos por corrida para saber estado
      const pagosPorCorrida = new Map<number, { total: number; lastDate: string | null }>();
      for (const p of ventaPagos) {
        const cur = pagosPorCorrida.get(p.corridafinancieraid) ?? { total: 0, lastDate: null };
        cur.total += (p.montopagado || 0) + (p.servicios_extra || 0);
        if (p.fechapago && (!cur.lastDate || p.fechapago > cur.lastDate)) cur.lastDate = p.fechapago;
        pagosPorCorrida.set(p.corridafinancieraid, cur);
      }

      // Cargos extras por corrida (igual que admin: suma cargos donde cargo.fecha <= corrida.fecha)
      const pendingPayments: Payment[] = [];
      const completedPayments: Payment[] = [];
      let totalCargosExtrasCount = 0;
      let totalRecargos = 0;

      for (const corrida of ventaCorridas) {
        const pagoCorrida = pagosPorCorrida.get(corrida.corridafinancieraid);
        const totalPagadoCorrida = pagoCorrida?.total ?? 0;

        // Cargos aplicables a esta corrida (igual que admin)
        const cargosAplicables = corrida.nopago !== 0
          ? loteCargos.filter(
              (c: any) => c.fecha && corrida.fecha && c.fecha <= corrida.fecha
            )
          : [];
        const cargoExtraAmount = cargosAplicables.reduce((s: number, c: any) => s + (c.monto || 0), 0);
        totalCargosExtrasCount += cargoExtraAmount;

        const recargo = totalPagadoCorrida === 0 && corrida.fecha
          ? calcularRecargo(corrida.fecha, venta.dias_tolerancia ?? 3)
          : 0;

        const esPagado = totalPagadoCorrida > 0;

        const payment: Payment = {
          id: String(corrida.corridafinancieraid),
          date: corrida.fecha,
          reason: `Mensualidad · ${lotKey}`,
          amount: esPagado
            ? totalPagadoCorrida
            : (corrida.mensualidad || 0) + cargoExtraAmount + recargo,
          status: esPagado ? 'pagado' : (
            new Date(corrida.fecha + 'T12:00:00') < new Date() ? 'atrasado' : (() => {
              const diff = Math.ceil((new Date(corrida.fecha + 'T12:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              return diff <= 7 ? 'por_vencer' : 'pendiente';
            })()
          ) as PaymentStatus,
          lotKey,
          breakdown: esPagado ? undefined : { base: corrida.mensualidad || 0, cargoExtra: cargoExtraAmount, recargo },
        };

        if (esPagado) {
          completedPayments.push({ ...payment, date: pagoCorrida?.lastDate ?? corrida.fecha });
        } else {
          totalRecargos += recargo;
          pendingPayments.push(payment);
        }
      }

      const totalAdeudado = saldoLote + totalCargosExtrasCount + totalRecargos;

      return {
        lotId: venta.loteid,
        ventaid: venta.ventaid,
        lotKey,
        developmentName: lote?.developmentName || 'N/A',
        preciolote: venta.preciolote || 0,
        totalPagado,
        saldoLote,
        totalCargosExtras: totalCargosExtrasCount,
        totalRecargos,
        totalAdeudado,
        pendingPayments,
        completedPayments,
      } as LoteSummary;
    });

    // 7. Totales globales
    const allPending = loteSummaries.flatMap((l) => l.pendingPayments);
    const allCompleted = loteSummaries.flatMap((l) => l.completedPayments);
    const pendingBalance = loteSummaries.reduce((s, l) => s + l.saldoLote, 0);
    const totalAdeudado = loteSummaries.reduce((s, l) => s + l.totalAdeudado, 0);

    const nextPayment = [...allPending].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0];

    return {
      pendingPayments: allPending,
      completedPayments: allCompleted,
      pendingBalance,
      totalAdeudado,
      lotes: loteSummaries,
      // nextPayment goes into lotes[0] or can be derived in UI
    } as PaymentSummary & { nextPayment?: Payment };
  }
};

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