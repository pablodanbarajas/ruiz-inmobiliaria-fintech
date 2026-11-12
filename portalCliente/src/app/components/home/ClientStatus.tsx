import { Link } from 'react-router';
import { AlertCircle, Calendar, CheckCircle, MessageCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../hooks/useAuth';
import { whatsappHref } from '../../config/contacto';

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (value: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value)
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

/** The client's situation at a glance, above the development catalog. */
export function ClientStatus() {
  const { paymentSummary, paymentsLoading, lots, lotsLoading } = useData();
  const { session } = useAuth();

  if (paymentsLoading || lotsLoading || !paymentSummary) {
    return <div className="h-20 bg-gray-100 rounded-xl animate-pulse mb-6" />;
  }

  // Signed up with an email that matches no client record: nothing to show.
  if (lots.length === 0 && paymentSummary.lotes.length === 0) {
    const email = session.user?.email ?? '';
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col md:flex-row md:items-center gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <div className="flex-1 text-sm text-amber-900">
          <p className="font-semibold">Aún no vemos compras ligadas a tu cuenta</p>
          <p className="mt-1">
            Buscamos con tu correo <strong>{email}</strong>. Si ya compraste con nosotros, escríbenos y
            ligamos tu cuenta para que veas tus lotes y pagos.
          </p>
        </div>
        <a
          href={whatsappHref(`Hola, ya soy cliente y quiero ligar mi cuenta del portal. Mi correo es ${email}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium"
        >
          <MessageCircle className="w-4 h-4" />
          Escribir por WhatsApp
        </a>
      </div>
    );
  }

  const pending = paymentSummary.pendingPayments;
  const atrasados = pending.filter((pago) => pago.status === 'atrasado');
  const siguiente = [...pending].sort((a, b) => a.date.localeCompare(b.date))[0];
  const iniciales = lots.filter((lote) => lote.status === 'apartado' || lote.status === 'apartado_confirmado');

  if (atrasados.length > 0) {
    const total = atrasados.reduce((sum, pago) => sum + pago.amount, 0);
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 flex flex-col md:flex-row md:items-center gap-4">
        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
        <div className="flex-1 text-sm text-red-900">
          <p className="font-semibold">
            Tienes {atrasados.length} pago{atrasados.length === 1 ? '' : 's'} vencido{atrasados.length === 1 ? '' : 's'} por {fmt(total)}
          </p>
          <p className="mt-1">Ponte al corriente para evitar que el recargo siga creciendo.</p>
        </div>
        <Link to="/mis-pagos" className="inline-flex justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium">
          Ir a pagar
        </Link>
      </div>
    );
  }

  if (iniciales.length > 0) {
    const lote = iniciales[0];
    const concepto = lote.status === 'apartado_confirmado' ? 'el enganche' : 'el apartado';
    return (
      <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-5 flex flex-col md:flex-row md:items-center gap-4">
        <Calendar className="w-6 h-6 text-orange-600 flex-shrink-0" />
        <div className="flex-1 text-sm text-orange-900">
          <p className="font-semibold">Falta pagar {concepto} del lote {lote.key}</p>
          {lote.nextPayment?.dueDate && <p className="mt-1">Fecha límite: {longDate(lote.nextPayment.dueDate)}</p>}
        </div>
        <Link to="/mis-pagos" className="inline-flex justify-center rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium">
          Pagar {concepto}
        </Link>
      </div>
    );
  }

  if (siguiente) {
    return (
      <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-5 flex flex-col md:flex-row md:items-center gap-4">
        <CheckCircle className="w-6 h-6 text-teal-700 flex-shrink-0" />
        <div className="flex-1 text-sm text-teal-900">
          <p className="font-semibold">Estás al corriente</p>
          <p className="mt-1">
            Tu próximo pago es de <strong>{fmt(siguiente.amount)}</strong> y vence el {longDate(siguiente.date)}.
          </p>
        </div>
        <Link to="/mis-pagos" className="inline-flex justify-center rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-sm font-medium">
          Ver mis pagos
        </Link>
      </div>
    );
  }

  return null;
}
