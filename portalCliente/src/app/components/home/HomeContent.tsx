import { useEffect, useState } from 'react';
import { Search, MapPin, DollarSign } from 'lucide-react';
import { Link } from 'react-router';
import { developmentsService } from '../../services';
import type { PublicDevelopment } from '../../types/development.types';
import { DevelopmentCard } from './DevelopmentCard';

type HomeContentProps = {
  isAuthenticated?: boolean;
  userName?: string | null;
};

export function HomeContent({
  isAuthenticated = false,
  userName = null
}: HomeContentProps) {
  const [developments, setDevelopments] = useState<PublicDevelopment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    location: '',
    minPrice: '',
    maxPrice: ''
  });

  useEffect(() => {
    developmentsService
      .getPublicDevelopments()
      .then(setDevelopments)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: conectar búsqueda a Supabase con filtros por ubicación y precio
  };

  const displayName = userName ?? 'Cliente';

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {isAuthenticated
            ? `Bienvenido, ${displayName}`
            : 'Bienvenido a Ruiz Inmobiliaria'}
        </h1>
        <p className="text-gray-600">
          Explora nuestros desarrollos disponibles y encuentra tu lote ideal.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ubicación
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Ciudad, estado..."
                value={searchParams.location}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, location: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de precio
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Mínimo"
                  value={searchParams.minPrice}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, minPrice: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Máximo"
                  value={searchParams.maxPrice}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, maxPrice: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full md:w-auto bg-teal-700 text-white px-8 py-2 rounded-lg hover:bg-teal-800 transition-colors flex items-center justify-center gap-2 h-[42px]"
          >
            <Search className="w-5 h-5" />
            Buscar
          </button>
        </form>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          Desarrollos disponibles
        </h2>

        {isLoading ? (
          <div className="space-y-6 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">
              {developments.length} desarrollos con lotes disponibles
            </p>
            <div className="space-y-6">
              {developments.map((development) => (
                <DevelopmentCard key={development.id} development={development} />
              ))}
            </div>
          </>
        )}
      </div>

      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Link
          to="/mis-lotes"
          className="bg-gradient-to-br from-teal-700 to-teal-800 text-white rounded-lg p-6 hover:shadow-lg transition-shadow block"
        >
          <h3 className="text-xl font-semibold mb-2">Ver mis lotes</h3>
          <p className="text-teal-100 text-sm">
            Consulta el estado de tus apartados y avance de compra.
          </p>
        </Link>

         <Link
          to="/mis-pagos"
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow block"
        >
          <h3 className="text-xl font-semibold mb-2">Mis pagos</h3>
          <p className="text-amber-100 text-sm">
            Revisa tu calendario de pagos e historial.
          </p>
        </Link>
        </div>
      )}
    </div>
  );
}
