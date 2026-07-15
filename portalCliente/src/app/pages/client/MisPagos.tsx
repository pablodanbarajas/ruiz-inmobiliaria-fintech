import { useState, useEffect } from 'react';
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
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 text-sm text-gray-600">
      <span>{Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-7 h-7 rounded text-xs font-medium ${
              p === page ? 'bg-teal-700 text-white' : 'hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
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

async function createPaymentLink(corridafinancieraid: string): Promise<{ url: string; sessionId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-link`, {
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
  return { url: data.url as string, sessionId: data.sessionId as string ?? '' };
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
  const hasExtras = bd && (bd.cargoExtra > 0 || bd.recargo > 0);
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
      <td className="px-6 py-4 text-sm text-gray-800">{pago.reason}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className="font-semibold text-gray-800">
          ${pago.amount.toLocaleString('es-MX')}
        </span>
        {isParcial && bd && (
          <div className="mt-1 space-y-0.5">
            <div className="text-xs text-amber-600 font-medium">
              Abonado: ${bd.pagadoParcial!.toLocaleString('es-MX')}
            </div>
            <div className="text-xs text-red-600 font-medium">
              Pendiente: ${pago.amount.toLocaleString('es-MX')}
            </div>
          </div>
        )}
        {!isParcial && hasExtras && bd && (
          <div className="mt-1 space-y-0.5">
            <div className="text-xs text-gray-400">
              Mensualidad: ${bd.base.toLocaleString('es-MX')}
            </div>
            {bd.cargoExtra > 0 && (
              <div className="text-xs text-purple-600 font-medium">
                + Cargos extra: ${bd.cargoExtra.toLocaleString('es-MX')}
              </div>
            )}
            {bd.recargo > 0 && (
              <div className="text-xs text-red-500 font-medium">
                + Recargo por mora: ${bd.recargo.toLocaleString('es-MX')}
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
}: {
  lote: LoteSummary;
  onPagar: (pago: Payment) => void;
  payingId: string | null;
}) {
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const pendingSlice = lote.pendingPayments.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);
  const completedSlice = lote.completedPayments.slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE);

  return (
    <div className="mb-10">
      {/* Tarjetas resumen del lote (igual que admin) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Precio Total</p>
          <p className="text-base font-bold text-blue-600">{fmt(lote.preciolote)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Pagado</p>
          <p className="text-base font-bold text-green-600">{fmt(lote.totalPagado)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Deuda del Lote</p>
          <p className="text-base font-bold text-orange-500">{fmt(lote.saldoLote)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Cargos Extra</p>
          <p className="text-base font-bold text-purple-600">{fmt(lote.totalCargosExtras)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Recargos</p>
          <p className="text-base font-bold text-orange-600">{fmt(lote.totalRecargos)}</p>
        </div>
        <div className="bg-white rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Adeudado</p>
          <p className="text-base font-bold text-red-600">{fmt(lote.totalAdeudado)}</p>
        </div>
      </div>

      {/* Pagos pendientes del lote */}
      {lote.pendingPayments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">
              Calendario de pagos — {lote.pendingPayments.length} pendiente{lote.pendingPayments.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              {tableHeaders(['Fecha límite', 'Motivo', 'Monto', 'Estado', 'Acción'])}
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingSlice.map((pago) => (
                  <PaymentRow
                    key={pago.id}
                    pago={pago}
                    action={
                      <button
                        onClick={() => onPagar(pago)}
                        disabled={payingId === pago.id}
                        className="bg-teal-700 text-white px-4 py-2 rounded-lg hover:bg-teal-800 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {payingId === pago.id ? 'Generando...' : 'Pagar ahora'}
                      </button>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={lote.pendingPayments.length} page={pendingPage} onPage={setPendingPage} />
        </div>
      )}

      {/* Pagos realizados del lote */}
      {lote.completedPayments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">
              Pagos realizados — {lote.completedPayments.length} pago{lote.completedPayments.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              {tableHeaders(['Fecha de pago', 'Motivo', 'Monto', 'Estado', 'Recibo'])}
              <tbody className="bg-white divide-y divide-gray-200">
                {completedSlice.map((pago) => (
                  <PaymentRow
                    key={pago.id}
                    pago={pago}
                    action={
                      <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                        <FileText className="w-3.5 h-3.5" />
                        Recibo enviado por email
                      </span>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={lote.completedPayments.length} page={completedPage} onPage={setCompletedPage} />
        </div>
      )}
    </div>
  );
}

export function MisPagos() {
  const { paymentSummary: summary, paymentsLoading: isLoading, refreshPayments, lots } = useData();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payingInitialVentaId, setPayingInitialVentaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Al regresar de Quentli, verificar y registrar el pago automáticamente
  useEffect(() => {
    const corridaId = searchParams.get('corridafinancieraid');
    if (!corridaId) return;

    const sessionId = sessionStorage.getItem(`quentli_session_${corridaId}`) ?? '';
    sessionStorage.removeItem(`quentli_session_${corridaId}`);

    // Limpiar URL sin recargar
    navigate('/mis-pagos', { replace: true });

    if (!sessionId) return;

    setVerifyState('verifying');
    verifyPayment(corridaId, sessionId)
      .then((result) => {
        if (result.ok) {
          setVerifyState('success');
          refreshPayments();
        } else {
          setVerifyState('idle');
        }
      })
      .catch(() => setVerifyState('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePagar = async (pago: Payment) => {
    try {
      setPayingId(pago.id);
      const { url, sessionId } = await createPaymentLink(pago.id);
      if (!url.startsWith('https://')) throw new Error('URL de pago inválida');
      if (sessionId) {
        sessionStorage.setItem(`quentli_session_${pago.id}`, sessionId);
      }
      window.location.href = url;
    } catch (err: any) {
      alert(`Error al generar link de pago: ${err.message}`);
    } finally {
      setPayingId(null);
    }
  };

  const handlePagarInicial = async (lote: ClientLot) => {
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
      window.location.href = url;
    } catch (err: any) {
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
                  {lote.nextPayment ? `$${lote.nextPayment.amount.toLocaleString('es-MX')}` : 'Monto pendiente'}
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
                  {next ? `$${next.amount.toLocaleString('es-MX')}` : '—'}
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
        />
      )}
    </div>
  );
}


