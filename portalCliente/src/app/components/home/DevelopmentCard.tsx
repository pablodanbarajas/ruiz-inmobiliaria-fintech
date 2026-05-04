import { MapPin, Map } from 'lucide-react';
import { Link } from 'react-router';
import type { PublicDevelopment } from '../../types/development.types';

interface DevelopmentCardProps {
  development: PublicDevelopment;
}

export function DevelopmentCard({ development }: DevelopmentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-72 h-48 flex-shrink-0 bg-gray-100">
          {development.imageUrl ? (
            <img
              src={development.imageUrl}
              alt={development.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xl font-bold text-gray-800">{development.name}</h3>
              <span className="bg-teal-50 text-teal-700 text-sm font-medium px-3 py-1 rounded-full border border-teal-200 whitespace-nowrap ml-4">
                {development.availableLots} lotes disponibles
              </span>
            </div>

            <div className="flex items-center gap-2 text-gray-600 mb-4">
              <MapPin className="w-4 h-4 text-teal-600" />
              <span className="text-sm">{development.location}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={development.mapsUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <MapPin className="w-4 h-4" />
              Ver ubicación
            </a>

            <Link
              to={`/desarrollos/${development.id}/mapa`}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors text-sm font-medium"
            >
              <Map className="w-4 h-4" />
              Ver lotes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}