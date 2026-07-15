import { MapPin, Map, Banknote, Star } from 'lucide-react';
import { Link } from 'react-router';
import type { PublicDevelopment } from '../../types/development.types';

interface DevelopmentCardProps {
  development: PublicDevelopment;
}

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function DevelopmentCard({ development }: DevelopmentCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        {/* Imagen — altura dinámica para cubrir todo el contenido */}
        <div className="relative w-full md:w-72 flex-shrink-0 bg-gray-100 min-h-[200px] self-stretch">
          {development.imageUrl ? (
            <img
              src={development.imageUrl}
              alt={development.name}
              className="absolute inset-0 w-full h-full object-contain object-center"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Map className="w-10 h-10 opacity-30" />
              <span className="text-xs">Sin imagen</span>
            </div>
          )}
          {development.hasInteractiveMap && (
            <span className="absolute top-3 left-3 bg-teal-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3" />
              Mapa interactivo
            </span>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 p-5 flex flex-col justify-between gap-4">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-xl font-bold text-gray-800 leading-tight">{development.name}</h3>
              <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full border border-teal-200 whitespace-nowrap flex-shrink-0">
                {development.availableLots} disponibles
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-sm">{development.location}</span>
            </div>
          </div>

          {/* Datos promocionales */}
          {(development.minApartado || development.enganche) && (
            <div className="grid grid-cols-2 gap-3">
              {development.minApartado && (
                <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
                  <p className="text-xs text-teal-600 font-medium mb-0.5">Aparta desde</p>
                  <p className="text-lg font-bold text-teal-700">{fmt(development.minApartado)}</p>
                  <p className="text-xs text-teal-500">MXN</p>
                </div>
              )}
              {development.enganche && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Banknote className="w-3 h-3 text-amber-500" />
                    <p className="text-xs text-amber-600 font-medium">Enganche</p>
                  </div>
                  <p className="text-lg font-bold text-amber-700">{fmt(development.enganche)}</p>
                  <p className="text-xs text-amber-500">MXN</p>
                </div>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-2">
            {development.mapsUrl ? (
              <a
                href={development.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <MapPin className="w-4 h-4" />
                Ver ubicación
              </a>
            ) : (
              <span className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
                <MapPin className="w-4 h-4" />
                Ubicación no disponible
              </span>
            )}
            <Link
              to={`/desarrollos/${development.id}/mapa`}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors text-sm font-medium"
            >
              <Map className="w-4 h-4" />
              Ver lotes disponibles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}