import { useEffect, useState } from 'react';
import { MapPin, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { lotsService } from '../../services';
import type { ClientLot, LotStatus } from '../../types/lot.types';
import { LotCard } from '../../components/lotes/LotCard';
import { SummaryCard } from '../../components/shared/SummaryCard';

type FilterStatus = 'todos' | LotStatus;

function parseDate(str: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T12:00:00') : new Date(str);
}

export function MisLotes() {
  const { session } = useAuth();
  const [lots, setLots] = useState<ClientLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('todos');

  useEffect(() => {
    if (!session.user) return;
    // Si ya hay datos cargados, no recargar (evita refresh al cambiar de pestaña del navegador)
    if (lots.length > 0) return;

    setIsLoading(true);
    lotsService
      .getClientLots(session.user.id)
      .then(setLots)
      .finally(() => setIsLoading(false));
  }, [session.user, lots]);

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
