import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, MapPin, DollarSign, X } from 'lucide-react';
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
  const [allDevelopments, setAllDevelopments] = useState<PublicDevelopment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationInput, setLocationInput] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    developmentsService
      .getPublicDevelopments()
      .then((data) => {
        setAllDevelopments(data);
        setDevelopments(data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const applyFilters = useCallback((loc: string, min: string, max: string, data: PublicDevelopment[]) => {
    const locLower = loc.toLowerCase().trim();
    const minNum = min ? Number(min) : null;
    const maxNum = max ? Number(max) : null;

    return data.filter((d) => {
      const matchesLocation = !locLower ||
        d.name.toLowerCase().includes(locLower) ||
        d.location.toLowerCase().includes(locLower);
      const price = d.minApartado ?? 0;
      const matchesMin = minNum === null || price >= minNum;
      const matchesMax = maxNum === null || price <= maxNum;
      return matchesLocation && matchesMin && matchesMax;
    });
  }, []);

  // Dynamic filter on every input change
  const handleLocationChange = (value: string) => {
    setLocationInput(value);
    setDevelopments(applyFilters(value, minPrice, maxPrice, allDevelopments));

    if (value.trim().length >= 1) {
      const query = value.toLowerCase();
      const matches = Array.from(new Set(
        allDevelopments.flatMap((d) => [d.name, d.location])
          .filter((s) => s && s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      )).slice(0, 5);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (value: string) => {
    setLocationInput(value);
    setShowSuggestions(false);
    setDevelopments(applyFilters(value, minPrice, maxPrice, allDevelopments));
  };

  const handleMinChange = (value: string) => {
    setMinPrice(value);
    setDevelopments(applyFilters(locationInput, value, maxPrice, allDevelopments));
  };

  const handleMaxChange = (value: string) => {
    setMaxPrice(value);
    setDevelopments(applyFilters(locationInput, minPrice, value, allDevelopments));
  };

  const handleReset = () => {
    setLocationInput('');
    setMinPrice('');
    setMaxPrice('');
    setSuggestions([]);
    setShowSuggestions(false);
    setDevelopments(allDevelopments);
  };

  const hasFilters = locationInput || minPrice || maxPrice;
  const displayName = userName ?? 'Cliente';

  return (
    <div className="max-w-7xl mx-auto px-8 py-4">
      {/* Header compacto + filtros en una sola fila */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="shrink-0">
          <h1 className="text-xl font-bold text-gray-800 leading-tight">
            {isAuthenticated ? `Bienvenido, ${displayName}` : 'Ruiz Inmobiliaria'}
          </h1>
          <p className="text-xs text-gray-500">Encuentra tu lote ideal</p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="flex flex-1 gap-2 items-center flex-wrap md:flex-nowrap">
          {/* Ubicación */}
          <div className="relative flex-1 min-w-[160px]" ref={locationRef}>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <input
              type="text"
              placeholder="Ubicación o nombre..."
              value={locationInput}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="w-full pl-9 pr-7 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              autoComplete="off"
            />
            {locationInput && (
              <button type="button" onClick={() => handleLocationChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {showSuggestions && (
              <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm text-gray-700 flex items-center gap-2"
                    >
                      <Search className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Precio mínimo */}
          <div className="relative w-32">
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="number"
              placeholder="Mín."
              value={minPrice}
              onChange={(e) => handleMinChange(e.target.value)}
              className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Precio máximo */}
          <div className="relative w-32">
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="number"
              placeholder="Máx."
              value={maxPrice}
              onChange={(e) => handleMaxChange(e.target.value)}
              className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="border border-gray-300 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-1 whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </form>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">
          Desarrollos disponibles
          {!isLoading && <span className="ml-2 text-sm font-normal text-gray-400">({developments.length})</span>}
        </h2>
      </div>

      <div className="mb-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
