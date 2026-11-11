import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Calendar, DollarSign, FileText, Clock, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Home } from 'lucide-react';

const PAGE_SIZE = 5;

function Pagination({
  total,
  page,
  onPage
}: {
  total: number;
  page: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 md:px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
      <span>{Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | '...')[]>((acc, p, i, arr) => {
            if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                className={`w-7 h-7 rounded text-xs font-medium ${
                  p === page ? 'bg-teal-700 text-white' : 'hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            )
          )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../context/DataContext';
import type { Payment, PaymentStatus, PaymentSummary, LoteSummary } from '../../types/payment.types';
import type { ClientLot } from '../../types/lot.types';
import { SummaryCard } from '../../components/shared/SummaryCard';
import { supabase } from '../../services/supabase/client';
import { openComprobante } from '../../utils/comprobante';
import { whatsappHref } from '../../config/contacto';
import { formatPersonName } from '../../utils/text';

async function createPaymentLink(corridafinancieraid: string): Promise<{ url: string; sessionId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-quentli-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ corridafinancieraid: Number(corridafinancieraid) }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error al generar link de pago');
  // invoiceId reemplaza sessionId — verify-payment detecta el prefijo inv_ automáticamente
  return { url: data.url as string, sessionId: data.invoiceId as string ?? '' };
}

async function verifyPayment(corridafinancieraid: string, sessionId: string): Promise<{ ok: boolean; alreadyRegistered?: boolean; registered?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ corridafinancieraid: Number(corridafinancieraid), sessionId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error al verificar pago');
  return data;
}

type InitialPaymentFlow = 'apartado' | 'enganche';

/** Checks with Quentli whether the reservation or down payment was paid, and records it. */
async function verifyInitialPayment(ventaid: string, flow: InitialPaymentFlow): Promise<{ ok: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/verify-${flow}-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ ventaid: Number(ventaid) }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error al verificar pago');
  return data;
}

async function createApartadoPaymentLink(ventaid: string): Promise<{ url: string; sessionId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-apartado-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ ventaid: Number(ventaid) }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error al generar link de pago de apartado');
  return { url: data.url as string, sessionId: data.sessionId as string ?? '' };
}

async function createEnganchePaymentLink(ventaid: string): Promise<{ url: string; sessionId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-enganche-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ ventaid: Number(ventaid) }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error al generar link de pago de enganche');
  return { url: data.url as string, sessionId: data.sessionId as string ?? '' };
}

function parseDate(str: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T12:00:00') : new Date(str);
}

const statusConfig: Record<PaymentStatus, { label: string; color: string; icon: typeof Clock }> = {
  pendiente:  { label: 'Pendiente',   color: 'bg-blue-100 text-blue-700',   icon: Clock },
  atrasado:   { label: 'Atrasado',    color: 'bg-red-100 text-red-700',     icon: AlertCircle },
  por_vencer: { label: 'Por vencer',  color: 'bg-orange-100 text-orange-700', icon: Clock },
  pagado:     { label: 'Pagado',      color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

function fmt(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function PaymentRow({
  pago,
  action
}: {
  pago: Payment;
  action: React.ReactNode;
}) {
  const config = statusConfig[pago.status];
  const Icon = config.icon;
  const bd = pago.breakdown;
  const hasExtras = bd && (bd.cargoExtra > 0 || bd.recargo > 0 || (bd.servicios ?? 0) > 0);
  const isParcial = bd && (bd.pagadoParcial ?? 0) > 0;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
        {parseDate(pago.date).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </td>
      <td className="px-6 py-4 text-sm text-gray-800">
        {pago.reason}
        {pago.dueDate && (
          <div className="text-xs text-gray-400 mt-0.5">
            Período: {parseDate(pago.dueDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className="font-semibold text-gray-800">
          {fmt(pago.amount)}
        </span>
        {isParcial && bd && (
          <div className="mt-1 space-y-0.5">
            <div className="text-xs text-amber-600 font-medium">
              Abonado: {fmt(bd.pagadoParcial!)}
            </div>
            <div className="text-xs text-red-600 font-medium">
              Pendiente: {fmt(pago.amount)}
            </div>
          </div>
        )}
        {!isParcial && hasExtras && bd && (
          <div className="mt-1 space-y-0.5">
            <div className="text-xs text-gray-400">
              Mensualidad: {fmt(bd.base)}
            </div>
            {bd.cargoExtra > 0 && (
              <div className="text-xs text-purple-600 font-medium">
                + Cargos extra: {fmt(bd.cargoExtra)}
              </div>
            )}
            {bd.recargo > 0 && (
              <div className="text-xs text-red-500 font-medium">
                + Recargo por mora: {fmt(bd.recargo)}
              </div>
            )}
            {(bd.servicios ?? 0) > 0 && (
              <div className="text-xs text-teal-700 font-medium">
                + Servicios / extra: {fmt(bd.servicios ?? 0)}
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">{action}</td>
    </tr>
  );
}

function PaymentCard({
  pago,
  action,
  dateLabel,
}: {
  pago: Payment;
  action: React.ReactNode;
  dateLabel: string;
}) {
  const config = statusConfig[pago.status];
  const Icon = config.icon;
  const bd = pago.breakdown;
  const hasExtras = bd && (bd.cargoExtra > 0 || bd.recargo > 0 || (bd.servicios ?? 0) > 0);
  const isParcial = bd && (bd.pagadoParcial ?? 0) > 0;

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{dateLabel}</p>
          <p className="text-sm font-semibold text-gray-800 mt-1">
            {parseDate(pago.date).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Motivo</p>
        <p className="text-sm text-gray-800 mt-1 break-words">{pago.reason}</p>
        {pago.dueDate && (
          <p className="text-xs text-gray-400 mt-0.5">
            Período: {parseDate(pago.dueDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Monto</p>
        <p className="text-lg font-bold text-gray-900 mt-1">{fmt(pago.amount)}</p>
        {isParcial && bd && (
          <div className="mt-2 space-y-0.5">
            <div className="text-xs text-amber-600 font-medium">
              Abonado: {fmt(bd.pagadoParcial!)}
            </div>
            <div className="text-xs text-red-600 font-medium">
              Pendiente: {fmt(pago.amount)}
            </div>
          </div>
        )}
        {!isParcial && hasExtras && bd && (
          <div className="mt-2 space-y-0.5">
            <div className="text-xs text-gray-400">
              Mensualidad: {fmt(bd.base)}
            </div>
            {bd.cargoExtra > 0 && (
              <div className="text-xs text-purple-600 font-medium">
                + Cargos extra: {fmt(bd.cargoExtra)}
              </div>
            )}
            {bd.recargo > 0 && (
              <div className="text-xs text-red-500 font-medium">
                + Recargo por mora: {fmt(bd.recargo)}
              </div>
            )}
            {(bd.servicios ?? 0) > 0 && (
              <div className="text-xs text-teal-700 font-medium">
                + Servicios / extra: {fmt(bd.servicios ?? 0)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-1">{action}</div>
    </div>
  );
}

const tableHeaders = (cols: string[]) => (
  <thead className="bg-gray-50">
    <tr>
      {cols.map((col) => (
        <th
          key={col}
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
        >
          {col}
        </th>
      ))}
    </tr>
  </thead>
);

function LoteSection({
  lote,
  onPagar,
  payingId,
  clienteNombre,
}: {
  lote: LoteSummary;
  onPagar: (pago: Payment) => void;
  payingId: string | null;
  clienteNombre: string;
}) {
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const pendingSlice = lote.pendingPayments.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);
  const completedSlice = lote.completedPayments.slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE);

  // What's due now gets the main button: overdue, about to be due, and the next
  // one. Later installments can still be paid early, with a quieter button.
  const nextPendingId = lote.pendingPayments[0]?.id;
  const isDueNow = (pago: Payment) =>
    pago.status === 'atrasado' || pago.status === 'por_vencer' || pago.id === nextPendingId;

  const payButton = (pago: Payment, fullWidth: boolean) => {
    const busy = payingId === pago.id;
    const base = `${fullWidth ? 'w-full py-2.5' : 'py-2'} px-4 rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed`;
    return isDueNow(pago) ? (
      <button onClick={() => onPagar(pago)} disabled={busy} className={`${base} bg-teal-700 text-white hover:bg-teal-800`}>
        {busy ? 'Generando...' : 'Pagar ahora'}
      </button>
    ) : (
      <button onClick={() => onPagar(pago)} disabled={busy} className={`${base} border border-teal-700 text-teal-700 hover:bg-teal-50`}>
        {busy ? 'Generando...' : 'Adelantar pago'}
      </button>
    );
  };

  const receiptButton = (pago: Payment) => (
    <button
      onClick={() => {
        const opened = openComprobante({
          pago,
          clienteNombre,
          lotKey: lote.lotKey,
          developmentName: lote.developmentName,
        });
        if (!opened) alert('No se pudo abrir el comprobante. Permite las ventanas emergentes para continuar.');
      }}
      className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-800 text-sm font-medium"
    >
      <FileText className="w-4 h-4" />
      Comprobante
    </button>
  );

  return (
    <div className="mb-10">
      {/* Tarjetas resumen del lote (igual que admin) */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-2 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Precio Total</p>
          <p className="text-xs md:text-base font-bold text-blue-600 break-all">{fmt(lote.preciolote)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-2 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Total Pagado</p>
          <p className="text-xs md:text-base font-bold text-green-600 break-all">{fmt(lote.totalPagado)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-2 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Deuda del Lote</p>
          <p className="text-xs md:text-base font-bold text-orange-500 break-all">{fmt(lote.saldoLote)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-2 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Cargos Extra</p>
          <p className="text-xs md:text-base font-bold text-purple-600 break-all">{fmt(lote.totalCargosExtras)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-2 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Recargos</p>
          <p className="text-xs md:text-base font-bold text-orange-600 break-all">{fmt(lote.totalRecargos)}</p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 md:p-4">
          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1">Total Adeudado</p>
          <p className="text-xs md:text-base font-bold text-red-600 break-all">{fmt(lote.totalAdeudado)}</p>
        </div>
      </div>

      {/* Pagos pendientes del lote */}
      {lote.pendingPayments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="px-4 md:px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">
              Calendario de pagos — {lote.pendingPayments.length} pendiente{lote.pendingPayments.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px]">
              {tableHeaders(['Fecha límite', 'Motivo', 'Monto', 'Estado', 'Acción'])}
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingSlice.map((pago) => (
                  <PaymentRow
                    key={pago.id}
                    pago={pago}
                    action={payButton(pago, false)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-4 space-y-3">
            {pendingSlice.map((pago) => (
              <PaymentCard
                key={pago.id}
                pago={pago}
                dateLabel="Fecha límite"
                action={payButton(pago, true)}
              />
            ))}
          </div>
          <Pagination total={lote.pendingPayments.length} page={pendingPage} onPage={setPendingPage} />
        </div>
      )}

      {/* Pagos realizados del lote */}
      {lote.completedPayments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 md:px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">
              Pagos realizados — {lote.completedPayments.length} pago{lote.completedPayments.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px]">
              {tableHeaders(['Fecha de pago', 'Motivo', 'Monto', 'Estado', 'Recibo'])}
              <tbody className="bg-white divide-y divide-gray-200">
                {completedSlice.map((pago) => (
                  <PaymentRow
                    key={pago.id}
                    pago={pago}
                    action={receiptButton(pago)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-4 space-y-3">
            {completedSlice.map((pago) => (
              <PaymentCard
                key={pago.id}
                pago={pago}
                dateLabel="Fecha de pago"
                action={receiptButton(pago)}
              />
            ))}
          </div>
          <Pagination total={lote.completedPayments.length} page={completedPage} onPage={setCompletedPage} />
        </div>
      )}
    </div>
  );
}

export function MisPagos() {
  const { paymentSummary: summary, paymentsLoading: isLoading, refreshPayments, refreshLots, lots } = useData();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingInitialVentaId, setPayingInitialVentaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refreshTimeouts = useRef<number[]>([]);

  const schedulePaymentRefresh = (corridaId: string, sessionId: string) => {
    refreshTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    refreshTimeouts.current = [1000, 3000, 7000, 15000].map((delay) =>
      window.setTimeout(async () => {
        try {
          const result = await verifyPayment(corridaId, sessionId);
          if (result.ok) {
            sessionStorage.removeItem(`quentli_session_${corridaId}`);
            refreshPayments();
            refreshTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
          }
        } catch {
          refreshPayments();
        }
      }, delay)
    );
  };

  // Paying in the Quentli tab usually takes longer than the first checks above,
  // so every return to this tab checks again each payment the client opened
  // here. Quentli's webhook normally records it first; this covers a missed one.
  const verifyingOpenPayments = useRef(false);
  const verifyOpenPayments = async () => {
    // focus and visibilitychange fire together when the client comes back.
    if (verifyingOpenPayments.current) return;
    verifyingOpenPayments.current = true;
    const keys = Object.keys(sessionStorage);
    const pending = keys
      .filter((key) => key.startsWith('quentli_session_'))
      .map((key) => ({ key, corridaId: key.slice('quentli_session_'.length), sessionId: sessionStorage.getItem(key) ?? '' }))
      .filter(({ sessionId }) => sessionId);
    const pendingInitial = keys
      .map((key) => {
        const match = key.match(/^(apartado|enganche)_session_(\d+)$/);
        return match ? { key, flow: match[1] as InitialPaymentFlow, ventaid: match[2] } : null;
      })
      .filter((item): item is { key: string; flow: InitialPaymentFlow; ventaid: string } => item !== null);

    let initialRecorded = false;
    await Promise.all([
      ...pending.map(async ({ key, corridaId, sessionId }) => {
        try {
          const result = await verifyPayment(corridaId, sessionId);
          if (result.ok) sessionStorage.removeItem(key);
        } catch {
          // Keep it for the next return to the tab.
        }
      }),
      ...pendingInitial.map(async ({ key, flow, ventaid }) => {
        try {
          const result = await verifyInitialPayment(ventaid, flow);
          if (result.ok) {
            sessionStorage.removeItem(key);
            initialRecorded = true;
          }
        } catch {
          // Keep it for the next return to the tab.
        }
      }),
    ]).finally(() => {
      verifyingOpenPayments.current = false;
    });
    // A paid reservation or down payment changes the lot's stage, not just its payments.
    if (initialRecorded) refreshLots();
  };

  const scheduleInitialPaymentCheck = (ventaid: string, flow: InitialPaymentFlow) => {
    refreshTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    refreshTimeouts.current = [5000, 15000, 30000, 60000].map((delay) =>
      window.setTimeout(async () => {
        try {
          const result = await verifyInitialPayment(ventaid, flow);
          if (result.ok) {
            sessionStorage.removeItem(`${flow}_session_${ventaid}`);
            refreshTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
            refreshLots();
            refreshPayments();
          }
        } catch {
          // The next check or the return to this tab tries again.
        }
      }, delay)
    );
  };

  // The listeners below are added once; the ref always points at this render's version.
  const verifyOpenPaymentsRef = useRef(verifyOpenPayments);
  verifyOpenPaymentsRef.current = verifyOpenPayments;

  useEffect(() => {
    const refreshWhenReturning = () => {
      if (document.visibilityState !== 'visible') return;
      verifyOpenPaymentsRef.current().finally(() => refreshPayments());
    };

    window.addEventListener('focus', refreshWhenReturning);
    document.addEventListener('visibilitychange', refreshWhenReturning);
    return () => {
      window.removeEventListener('focus', refreshWhenReturning);
      document.removeEventListener('visibilitychange', refreshWhenReturning);
      refreshTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [refreshPayments]);

  // Al regresar de Quentli, verificar y registrar el pago automáticamente
  useEffect(() => {
    const corridaId = searchParams.get('corridafinancieraid');
    if (!corridaId) return;

    const sessionKey = `quentli_session_${corridaId}`;
    const sessionId = sessionStorage.getItem(sessionKey) ?? '';

    // Limpiar URL sin recargar
    navigate('/mis-pagos', { replace: true });

    if (!sessionId) return;

    setVerifyState('verifying');
    verifyPayment(corridaId, sessionId)
      .then((result) => {
        if (result.ok) {
          // Forget it only once recorded; otherwise returning to the tab retries.
          sessionStorage.removeItem(sessionKey);
          setVerifyState('success');
          refreshPayments();
        } else {
          setVerifyState('idle');
        }
      })
      .catch(() => setVerifyState('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePagar = async (pago: Payment) => {
    const paymentWindow = window.open('about:blank', '_blank');
    if (!paymentWindow) {
      alert('No se pudo abrir la ventana de pago. Permite las ventanas emergentes para continuar.');
      return;
    }

    try {
      setPayingId(pago.id);
      const { url, sessionId } = await createPaymentLink(pago.id);
      if (!url.startsWith('https://')) throw new Error('URL de pago inválida');
      if (sessionId) {
        sessionStorage.setItem(`quentli_session_${pago.id}`, sessionId);
      }
      paymentWindow.location.href = url;
      schedulePaymentRefresh(pago.id, sessionId);
    } catch (err: any) {
      paymentWindow.close();
      alert(`Error al generar link de pago: ${err.message}`);
    } finally {
      setPayingId(null);
    }
  };

  const handlePagarInicial = async (lote: ClientLot) => {
    const paymentWindow = window.open('about:blank', '_blank');
    if (!paymentWindow) {
      alert('No se pudo abrir la ventana de pago. Permite las ventanas emergentes para continuar.');
      return;
    }

    try {
      setPayingInitialVentaId(lote.ventaid);
      const isEnganche = lote.status === 'apartado_confirmado';
      const { url, sessionId } = isEnganche
        ? await createEnganchePaymentLink(lote.ventaid)
        : await createApartadoPaymentLink(lote.ventaid);
      if (!url.startsWith('https://')) throw new Error('URL de pago inválida');
      if (sessionId) {
        if (isEnganche) {
          sessionStorage.setItem(`enganche_session_${lote.ventaid}`, sessionId);
        } else {
          sessionStorage.setItem(`apartado_session_${lote.ventaid}`, sessionId);
        }
      }
      paymentWindow.location.href = url;
      scheduleInitialPaymentCheck(lote.ventaid, isEnganche ? 'enganche' : 'apartado');
    } catch (err: any) {
      paymentWindow.close();
      alert(`Error al generar link de pago: ${err.message}`);
    } finally {
      setPayingInitialVentaId(null);
    }
  };

  if (isLoading || !summary) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-72" />
          <div className="grid grid-cols-2 gap-6 mt-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { pendingPayments, lotes, totalAdeudado } = summary;
  const pagosInicialesPendientes = lots.filter(
    (lote) => lote.status === 'apartado' || lote.status === 'apartado_confirmado'
  );

  // Próximo pago por cada lote
  const proximosPorLote = lotes.map((lote) => {
    const next = [...lote.pendingPayments].sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    )[0];
    return { lote, next };
  });

  const loteActivo = lotes[activeTab];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 leading-tight">Mis pagos</h1>
        <p className="text-xs text-gray-500">Consulta tu calendario, historial y comprobantes</p>
      </div>

      {/* Banner de verificación de pago */}
      {verifyState === 'verifying' && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Verificando tu pago con Quentli...
        </div>
      )}
      {verifyState === 'success' && (
        <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 text-green-600" />
          ¡Pago registrado exitosamente! Tu estado de cuenta ha sido actualizado.
        </div>
      )}
      {verifyState === 'error' && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-red-600" />
          No se pudo verificar el pago automáticamente. Si realizaste el pago, contáctanos.
        </div>
      )}

      {/* Cards globales */}
      {pagosInicialesPendientes.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-semibold text-gray-700">Pagos iniciales pendientes</span>
          </div>
          <div className="space-y-3">
            {pagosInicialesPendientes.map((lote) => (
              <div key={lote.ventaid} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-orange-100 rounded-lg p-3 bg-orange-50/40">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Lote {lote.key}</p>
                  <p className="text-xs text-gray-500">{lote.developmentName}</p>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {lote.nextPayment ? fmt(lote.nextPayment.amount) : 'Monto pendiente'}
                </div>
                <button
                  onClick={() => handlePagarInicial(lote)}
                  disabled={payingInitialVentaId === lote.ventaid}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {payingInitialVentaId === lote.ventaid
                    ? 'Generando...'
                    : lote.status === 'apartado_confirmado'
                    ? 'Pagar enganche'
                    : 'Pagar apartado'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
        {/* Próximos pagos — uno por lote */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-semibold text-gray-700">Próximos pagos</span>
          </div>
          <div className="space-y-3">
            {proximosPorLote.map(({ lote, next }) => (
              <div key={lote.ventaid} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{lote.lotKey}</p>
                  <p className="text-xs text-gray-400">
                    {next ? `Vence el ${parseDate(next.date).toLocaleDateString('es-MX')}` : 'Sin pagos pendientes'}
                  </p>
                </div>
                <span className="text-base font-bold text-gray-900">
                  {next ? fmt(next.amount) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <SummaryCard
          title="Total adeudado"
          value={fmt(totalAdeudado)}
          subtitle={`${lotes.length} lote${lotes.length !== 1 ? 's' : ''} · ${pendingPayments.length} pagos pendientes`}
          icon={DollarSign}
          color="teal"
        />
      </div>

      {lotes.length === 0 && pagosInicialesPendientes.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Aún no vemos pagos ligados a tu cuenta</h3>
          <p className="text-sm text-gray-600 mb-5">
            Si ya compraste con nosotros, escríbenos y ligamos tu cuenta para que veas tu calendario de pagos.
          </p>
          <a
            href={whatsappHref('Hola, ya soy cliente y quiero ligar mi cuenta del portal.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 text-sm font-medium"
          >
            Escribir por WhatsApp
          </a>
        </div>
      )}

      {/* Pestañas por lote */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {lotes.map((lote, idx) => (
            <button
              key={lote.ventaid}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-4 md:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === idx
                  ? 'border-teal-700 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>{lote.lotKey}</span>
              <span className="text-xs text-gray-400 hidden sm:inline">{lote.developmentName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del lote activo */}
      {loteActivo && (
        <LoteSection
          lote={loteActivo}
          onPagar={handlePagar}
          payingId={payingId}
          clienteNombre={formatPersonName(summary.clienteNombre)}
        />
      )}
    </div>
  );
}
