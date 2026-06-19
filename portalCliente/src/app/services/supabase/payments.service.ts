import { supabase } from './client';
import type { IPaymentsService } from '../interfaces';
import type { Payment, PaymentSummary, PaymentStatus, LoteSummary } from '../../types/payment.types';

// Helper: calcular recargo igual que el admin (calcularRecargo en helpers.ts)
function calcularRecargo(fechaVencimiento: string, diasTolerancia: number = 0): number {
  const vencimiento = new Date(fechaVencimiento + 'T12:00:00');
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const diasAtraso = Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24)) - diasTolerancia;
  if (diasAtraso <= 0) return 0;
  const semanas = Math.ceil(diasAtraso / 6);
  return semanas * 150; // $150 inmediato al 1er día, +$150 cada 6 días adicionales
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
      .select('cargoid, loteid, monto, estatus, fecha, fecha_fin')
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

        // Cargos aplicables a esta corrida (igual que admin: fecha_inicio <= corrida.fecha <= fecha_fin)
        const cargosAplicables = corrida.nopago !== 0
          ? loteCargos.filter(
              (c: any) => c.fecha && corrida.fecha && c.fecha <= corrida.fecha
                && (!c.fecha_fin || c.fecha_fin >= corrida.fecha)
            )
          : [];
        const cargoExtraAmount = cargosAplicables.reduce((s: number, c: any) => s + (c.monto || 0), 0);
        totalCargosExtrasCount += cargoExtraAmount;

        const recargo = totalPagadoCorrida === 0 && corrida.fecha
          ? calcularRecargo(corrida.fecha, venta.dias_tolerancia ?? 0)
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
