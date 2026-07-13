import { useState, useEffect } from 'react';
import { MapPin, Calendar, CheckCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useSearchParams, useNavigate } from 'react-router';
import type { ClientLot, LotStatus } from '../../types/lot.types';
import { LotCard } from '../../components/lotes/LotCard';
import { SummaryCard } from '../../components/shared/SummaryCard';
import { supabase } from '../../services/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type FilterStatus = 'todos' | LotStatus;

function parseDate(str: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T12:00:00') : new Date(str);
}

export function MisLotes() {
  const { lots, lotsLoading: isLoading, refreshLots } = useData();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('todos');
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Al regresar de Quentli apartado, verificar y registrar automáticamente
  useEffect(() => {
    const apartadoVentaid = searchParams.get('apartado_ventaid');
    if (!apartadoVentaid) return;

    const sessionId = sessionStorage.getItem(`apartado_session_${apartadoVentaid}`) ?? '';
    sessionStorage.removeItem(`apartado_session_${apartadoVentaid}`);
    navigate('/mis-lotes', { replace: true });

    if (!sessionId) return;

    setVerifyState('verifying');

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setVerifyState('error'); return; }

      fetch(`${SUPABASE_URL}/functions/v1/verify-apartado-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ventaid: Number(apartadoVentaid) }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setVerifyState('success');
            refreshLots();
          } else {
            setVerifyState('error');
          }
        })
        .catch(() => setVerifyState('error'));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Al regresar de Quentli enganche, verificar y registrar automáticamente
  useEffect(() => {
    const engancheVentaid = searchParams.get('enganche_ventaid');
    if (!engancheVentaid) return;

    const sessionId = sessionStorage.getItem(`enganche_session_${engancheVentaid}`) ?? '';
    sessionStorage.removeItem(`enganche_session_${engancheVentaid}`);
    navigate('/mis-lotes', { replace: true });

    if (!sessionId) return;

    setVerifyState('verifying');

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setVerifyState('error'); return; }

      fetch(`${SUPABASE_URL}/functions/v1/verify-enganche-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ventaid: Number(engancheVentaid), sessionId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setVerifyState('success');
            refreshLots();
          } else {
            setVerifyState('error');
          }
        })
        .catch(() => setVerifyState('error'));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeLots   = lots.filter((l) => l.status !== 'finalizado').length;
  const finishedLots = lots.filter((l) => l.status === 'finalizado').length;

  const nextPayment = lots
    .filter((l) => l.nextPayment)
    .sort((a, b) => {
      const dateA = a.nextPayment ? parseDate(a.nextPayment.dueDate).getTime() : 0;
      const dateB = b.nextPayment ? parseDate(b.nextPayment.dueDate).getTime() : 0;
      return dateA - dateB;
    })[0]?.nextPayment;

  const filters: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'todos',    label: 'Todos',      count: lots.length },
    {
      key: 'apartado',
      label: 'Apartados',
      count: lots.filter((l) => l.status === 'apartado' || l.status === 'apartado_confirmado').length
    },
    {
      key: 'en_pagos',
      label: 'En pagos',
      count: lots.filter((l) => l.status === 'en_pagos').length
    },
    {
      key: 'finalizado',
      label: 'Finalizados',
      count: lots.filter((l) => l.status === 'finalizado').length
    }
  ];

  const filteredLots =
    activeFilter === 'todos'
      ? lots
      : lots.filter((lote) => {
          if (activeFilter === 'apartado') {
            return lote.status === 'apartado' || lote.status === 'apartado_confirmado';
          }
          return lote.status === activeFilter;
        });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-72" />
          <div className="grid grid-cols-3 gap-6 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 leading-tight">Mis lotes</h1>
        <p className="text-xs text-gray-500">Consulta el estado de tus apartados y avance de compra</p>
      </div>

      {/* Banner verificación enganche */}
      {verifyState === 'verifying' && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Verificando tu pago de enganche con Quentli...
        </div>
      )}
      {verifyState === 'success' && (
        <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          ¡Enganche registrado! Tu lote está en proceso de formalización. Un asesor se pondrá en contacto contigo.
        </div>
      )}
      {verifyState === 'error' && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          No se pudo verificar el pago. Si realizaste el pago, contacta a tu asesor.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SummaryCard
          title="Lotes activos"
          value={activeLots}
          subtitle={`${activeLots} ${activeLots === 1 ? 'lote activo' : 'lotes activos'}`}
          icon={MapPin}
          color="teal"
        />
        <SummaryCard
          title="Próximo pago"
          value={nextPayment ? `$${nextPayment.amount.toLocaleString('es-MX')}` : 'N/A'}
          subtitle={
            nextPayment
              ? `Vence el ${parseDate(nextPayment.dueDate).toLocaleDateString('es-MX')}`
              : 'Sin pagos pendientes'
          }
          icon={Calendar}
          color="orange"
        />
        <SummaryCard
          title="Lotes finalizados"
          value={finishedLots}
          subtitle={`${finishedLots} ${finishedLots === 1 ? 'lote liquidado' : 'lotes liquidados'}`}
          icon={CheckCircle}
          color="green"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1.5 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {filters.map((filtro) => (
            <button
              key={filtro.key}
              onClick={() => setActiveFilter(filtro.key)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap
                ${activeFilter === filtro.key
                  ? 'bg-teal-700 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {filtro.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  activeFilter === filtro.key
                    ? 'bg-teal-600'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {filtro.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredLots.length > 0 ? (
          filteredLots.map((lote) => <LotCard key={lote.id} lote={lote} />)
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No hay lotes en esta categoría
            </h3>
            <p className="text-gray-600">Selecciona otro filtro para ver tus lotes</p>
          </div>
        )}
      </div>
    </div>
  );
}
