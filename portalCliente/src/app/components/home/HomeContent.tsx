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
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col md:flex-row gap-4 items-end">
          {/* Ubicación con sugerencias */}
          <div className="flex-1 w-full" ref={locationRef}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ubicación
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
              <input
                type="text"
                placeholder="Nombre o ciudad..."
                value={locationInput}
                onChange={(e) => handleLocationChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                autoComplete="off"
              />
              {locationInput && (
                <button type="button" onClick={() => handleLocationChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              {showSuggestions && (
                <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onMouseDown={() => handleSelectSuggestion(s)}
                        className="w-full text-left px-4 py-2 hover:bg-teal-50 text-sm text-gray-700 flex items-center gap-2"
                      >
                        <Search className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Rango de precio */}
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de precio (apartado)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={minPrice}
                  onChange={(e) => handleMinChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  placeholder="Máximo"
                  value={maxPrice}
                  onChange={(e) => handleMaxChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="w-full md:w-auto border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors h-[42px] text-sm flex items-center gap-2 justify-center"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
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
