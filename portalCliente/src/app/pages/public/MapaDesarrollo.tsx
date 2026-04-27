import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { developmentsService } from '../../services';
import type { PublicDevelopment } from '../../types/development.types';

/**
 * Página del mapa interactivo de lotes por desarrollo.
 *
 * Estado actual: placeholder visual con la estructura correcta.
 *
 * Integración futura:
 *   - Consumir mapService.getMapLots(developmentId) para obtener MapLot[]
 *   - Renderizar el visor tipo boletería con estado de cada lote
 *   - Lotes disponibles permiten iniciar flujo de apartado (requiere auth)
 *   - Solo exponer MapLot (sin datos financieros ni de cliente)
 */
export function MapaDesarrollo() {
  const { id } = useParams<{ id: string }>();
  const [development, setDevelopment] = useState<PublicDevelopment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    developmentsService.getPublicDevelopments().then((devs) => {
      setDevelopment(devs.find((d) => d.id === id) ?? null);
      setIsLoading(false);
    });
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-16 text-center">
        <div className="animate-pulse h-8 bg-gray-200 rounded w-64 mx-auto" />
      </div>
    );
  }

  if (!development) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Desarrollo no encontrado
        </h2>
        <Link
          to="/"
          className="text-teal-700 hover:text-teal-800 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Mapa interactivo — {development.name}
              </h1>
              <p className="text-sm text-gray-500">{development.location}</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            {development.availableLots} lotes disponibles
          </span>
        </div>
      </div>

      <div className="flex-1">
        {development.hasInteractiveMap ? (
          <iframe
            src="/portal/mapa/index.html"
            className="w-full h-full border-0"
            style={{ minHeight: 'calc(100vh - 120px)' }}
            title={`Mapa interactivo — ${development.name}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[calc(100vh-120px)] bg-gray-50">
            <div className="text-center max-w-md px-8">
              <div className="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowLeft className="w-8 h-8 rotate-180" />
              </div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Mapa no disponible</h2>
              <p className="text-gray-500 text-sm">
                El mapa interactivo de este desarrollo aún no está disponible.
                Contacta a un asesor para más información.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
