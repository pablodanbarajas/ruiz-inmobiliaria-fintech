import { useEffect, useState } from 'react';
import { Calendar, DollarSign, FileText, Clock, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

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
import { paymentsService } from '../../services';
import type { Payment, PaymentStatus, PaymentSummary } from '../../types/payment.types';
import { SummaryCard } from '../../components/shared/SummaryCard';

// Las fechas de BD vienen como 'YYYY-MM-DD'. new Date('YYYY-MM-DD') las parsea como
// UTC medianoche, lo que en México (UTC-5/6) muestra un día antes. Esta función lo corrige.
function parseDate(str: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T12:00:00') : new Date(str);
}

const statusConfig: Record<PaymentStatus, { label: string; color: string; icon: typeof Clock }> = {
  pendiente:  { label: 'Pendiente',   color: 'bg-blue-100 text-blue-700',   icon: Clock },
  atrasado:   { label: 'Atrasado',    color: 'bg-red-100 text-red-700',     icon: AlertCircle },
  por_vencer: { label: 'Por vencer',  color: 'bg-orange-100 text-orange-700', icon: Clock },
  pagado:     { label: 'Pagado',      color: 'bg-green-100 text-green-700', icon: CheckCircle }
};

function PaymentRow({
  pago,
  action
}: {
  pago: Payment;
  action: React.ReactNode;
}) {
  const config = statusConfig[pago.status];
  const Icon = config.icon;

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
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
        ${pago.amount.toLocaleString('es-MX')}
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

export function MisPagos() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  useEffect(() => {
    if (!session.user) return;

    setIsLoading(true);
    paymentsService
      .getClientPayments(session.user.id)
      .then(setSummary)
      .finally(() => setIsLoading(false));
  }, [session.user]);

  if (isLoading || !summary) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8">
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

  const { pendingPayments, completedPayments } = summary;

  const proximoPago = [...pendingPayments].sort(
    (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
  )[0];

  const saldoPendiente = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const pendingSlice   = pendingPayments.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);
  const completedSlice = completedPayments.slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Mis pagos</h1>
        <p className="text-gray-600">
          Consulta tu calendario, historial y comprobantes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <SummaryCard
          title="Próximo pago"
          value={proximoPago ? `$${proximoPago.amount.toLocaleString('es-MX')}` : 'N/A'}
          subtitle={
            proximoPago
              ? `Vence el ${parseDate(proximoPago.date).toLocaleDateString('es-MX')}`
              : 'Sin pagos próximos'
          }
          icon={Calendar}
          color="orange"
        />
        <SummaryCard
          title="Saldo pendiente"
          value={`$${saldoPendiente.toLocaleString('es-MX')}`}
          subtitle={`${pendingPayments.length} ${pendingPayments.length === 1 ? 'pago pendiente' : 'pagos pendientes'}`}
          icon={DollarSign}
          color="teal"
        />
      </div>

      {/* Calendario de pagos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Calendario de pagos</h2>
          <p className="text-sm text-gray-600 mt-1">Pagos pendientes y próximos vencimientos</p>
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
                    <button className="bg-teal-700 text-white px-4 py-2 rounded-lg hover:bg-teal-800 transition-colors text-sm font-medium">
                      Pagar ahora
                    </button>
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={pendingPayments.length} page={pendingPage} onPage={setPendingPage} />
      </div>

      {/* Historial */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Pagos realizados</h2>
          <p className="text-sm text-gray-600 mt-1">Historial completo de tus pagos</p>
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
                    <button className="flex items-center gap-2 text-teal-700 hover:text-teal-800 transition-colors text-sm font-medium">
                      <FileText className="w-4 h-4" />
                      Ver recibo
                    </button>
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={completedPayments.length} page={completedPage} onPage={setCompletedPage} />
      </div>
    </div>
  );
}
