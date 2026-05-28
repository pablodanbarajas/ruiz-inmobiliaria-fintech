import { useState } from 'react';
import { MapPin, Ruler, DollarSign, Clock, ChevronRight, ImageOff } from 'lucide-react';
import type { ClientLot } from '../../types/lot.types';

interface LotCardProps {
  lote: ClientLot;
}

const statusConfig = {
  apartado: {
    label: 'Apartado',
    sublabel: 'Pago pendiente',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    buttonLabel: 'Pagar apartado',
    buttonColor: 'bg-orange-600 hover:bg-orange-700'
  },
  apartado_confirmado: {
    label: 'Apartado confirmado',
    sublabel: 'Pendiente de enganche',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    buttonLabel: 'Pagar enganche',
    buttonColor: 'bg-blue-600 hover:bg-blue-700'
  },
  en_pagos: {
    label: 'En pagos',
    sublabel: 'Mensualidades activas',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    buttonLabel: 'Ver siguiente paso',
    buttonColor: 'bg-teal-600 hover:bg-teal-700'
  },
  finalizado: {
    label: 'Finalizado',
    sublabel: 'Lote liquidado',
    color: 'bg-green-50 text-green-700 border-green-200',
    buttonLabel: 'Ver escrituras',
    buttonColor: 'bg-green-600 hover:bg-green-700'
  }
} as const;

export function LotCard({ lote }: LotCardProps) {
  const config = statusConfig[lote.status];
  const progressPct = (lote.progress.currentStage / (lote.progress.stages.length - 1)) * 100;
  const [imgError, setImgError] = useState(false);
  const showPlaceholder = !lote.imageUrl || imgError;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row">
        <div className="w-full lg:w-48 h-48 lg:h-auto flex-shrink-0">
          {showPlaceholder ? (
            <div className="w-full h-full bg-gradient-to-br from-teal-50 to-teal-100 flex flex-col items-center justify-center gap-2 text-teal-400">
              <ImageOff className="w-10 h-10" />
              <span className="text-sm font-medium text-teal-500">Sin imagen disponible</span>
            </div>
          ) : (
            <img
              src={lote.imageUrl}
              alt={`Lote ${lote.key}`}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-0.5">Lote {lote.key}</h3>
                <p className="text-sm text-gray-600">{lote.developmentName}</p>
              </div>
              <div className={`px-3 py-1 rounded-lg border text-right flex-shrink-0 ${config.color}`}>
                <p className="font-semibold text-xs">{config.label}</p>
                <p className="text-xs opacity-75">{config.sublabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
              <div className="flex items-center gap-1 text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-xs">{lote.location}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500">
                <Ruler className="w-3.5 h-3.5" />
                <span className="text-xs">{lote.surface}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">${lote.price.toLocaleString('es-MX')}</span>
              </div>
            </div>

            {/* Progreso de compra */}
            <div className="mb-3 overflow-x-auto">
              <div className="flex justify-between mb-1.5 min-w-[380px]">
                {lote.progress.stages.map((etapa, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        index <= lote.progress.currentStage
                          ? 'bg-teal-700 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 text-center leading-tight ${
                        index <= lote.progress.currentStage
                          ? 'text-gray-700 font-medium'
                          : 'text-gray-400'
                      }`}
                    >
                      {etapa}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 min-w-[380px]">
                <div
                  className="bg-teal-700 h-1.5 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {lote.nextPayment && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Próximo pago</p>
                  <p className="text-base font-bold text-gray-800">${lote.nextPayment.amount.toLocaleString('es-MX')}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-orange-600 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">
                      Vence: {new Date(lote.nextPayment.dueDate + 'T12:00:00').toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{lote.nextPayment.paymentType}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className={`flex-1 ${config.buttonColor} text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium`}
            >
              {config.buttonLabel}
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 text-sm">
              Ver detalle
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
