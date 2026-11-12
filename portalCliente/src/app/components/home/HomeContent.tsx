import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router';
import { developmentsService } from '../../services';
import type { PublicDevelopment } from '../../types/development.types';
import { DevelopmentCard } from './DevelopmentCard';

type HomeContentProps = {
  isAuthenticated?: boolean;
  userName?: string | null;
  initialDevelopments?: PublicDevelopment[];
  developmentsLoading?: boolean;
};

type MontoTipo = 'apartado' | 'enganche';
type Orden = 'recomendado' | 'apartado' | 'enganche' | 'disponibles';

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const montoDe = (d: PublicDevelopment, tipo: MontoTipo) =>
  tipo === 'apartado' ? d.minApartado : d.enganche;

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Slider bounds rounded to a friendly step, built from the amounts that exist. */
function limitesDelRango(valores: number[]) {
  if (valores.length === 0) return null;
  const maxVal = Math.max(...valores);
  const minVal = Math.min(...valores);
  const paso = maxVal > 50000 ? 5000 : maxVal > 10000 ? 1000 : 500;
  const max = Math.ceil(maxVal / paso) * paso;
  let min = Math.floor(minVal / paso) * paso;
  if (min >= max) min = 0;
  return { min, max, paso };
}

export function HomeContent({
  isAuthenticated = false,
  userName = null,
  initialDevelopments,
}: HomeContentProps) {
  const [allDevelopments, setAllDevelopments] = useState<PublicDevelopment[]>(initialDevelopments ?? []);
  const [isLoading, setIsLoading] = useState(initialDevelopments ? false : true);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [sugerenciaActiva, setSugerenciaActiva] = useState(-1);
  const [montoTipo, setMontoTipo] = useState<MontoTipo>('apartado');
  // null = no limit; the slider starts at its maximum so nothing is hidden.
  const [presupuesto, setPresupuesto] = useState<number | null>(null);
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [orden, setOrden] = useState<Orden>('recomendado');
  const busquedaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDevelopments && initialDevelopments.length > 0) {
      setAllDevelopments(initialDevelopments);
      setIsLoading(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      developmentsService
        .getPublicDevelopments()
        .then((data) => {
          if (data && data.length > 0) setAllDevelopments(data);
        })
        .catch((error) => console.error('Error loading developments:', error))
        .finally(() => setIsLoading(false));
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [initialDevelopments]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) {
        setMostrarSugerencias(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const rango = useMemo(
    () =>
      limitesDelRango(
        allDevelopments
          .map((d) => montoDe(d, montoTipo))
          .filter((v): v is number => typeof v === 'number' && v > 0)
      ),
    [allDevelopments, montoTipo]
  );

  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return [];
    return Array.from(
      new Set(
        allDevelopments
          .flatMap((d) => [d.name, d.location])
          .filter((s) => s && normalizar(s).includes(q) && normalizar(s) !== q)
      )
    ).slice(0, 5);
  }, [busqueda, allDevelopments]);

  // Everything except the budget, so the empty state can say how much budget would help.
  const sinPresupuesto = useMemo(() => {
    const q = normalizar(busqueda);
    return allDevelopments.filter((d) => {
      const coincide = !q || normalizar(d.name).includes(q) || normalizar(d.location).includes(q);
      const disponible = !soloDisponibles || d.availableLots > 0;
      return coincide && disponible;
    });
  }, [allDevelopments, busqueda, soloDisponibles]);

  const developments = useMemo(() => {
    const filtrados = sinPresupuesto.filter((d) => {
      if (presupuesto === null) return true;
      const monto = montoDe(d, montoTipo);
      return typeof monto === 'number' && monto <= presupuesto;
    });
    const porMonto = (tipo: MontoTipo) => (a: PublicDevelopment, b: PublicDevelopment) =>
      (montoDe(a, tipo) ?? Infinity) - (montoDe(b, tipo) ?? Infinity);
    if (orden === 'apartado') return [...filtrados].sort(porMonto('apartado'));
    if (orden === 'enganche') return [...filtrados].sort(porMonto('enganche'));
    if (orden === 'disponibles') return [...filtrados].sort((a, b) => b.availableLots - a.availableLots);
    return filtrados;
  }, [sinPresupuesto, presupuesto, montoTipo, orden]);

  // Smallest amount among the hidden developments, to suggest raising the budget.
  const montoParaVerMas = useMemo(() => {
    if (presupuesto === null) return null;
    const ocultos = sinPresupuesto
      .map((d) => montoDe(d, montoTipo))
      .filter((v): v is number => typeof v === 'number' && v > presupuesto);
    return ocultos.length ? Math.min(...ocultos) : null;
  }, [sinPresupuesto, presupuesto, montoTipo]);

  const cambiarTipo = (tipo: MontoTipo) => {
    setMontoTipo(tipo);
    setPresupuesto(null);
  };

  const elegirSugerencia = (valor: string) => {
    setBusqueda(valor);
    setMostrarSugerencias(false);
    setSugerenciaActiva(-1);
  };

  const onTeclaBusqueda = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mostrarSugerencias || sugerencias.length === 0) {
      if (e.key === 'Escape') setBusqueda('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSugerenciaActiva((i) => (i + 1) % sugerencias.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSugerenciaActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === 'Enter' && sugerenciaActiva >= 0) {
      e.preventDefault();
      elegirSugerencia(sugerencias[sugerenciaActiva]);
    } else if (e.key === 'Escape') {
      setMostrarSugerencias(false);
    }
  };

  const limpiar = () => {
    setBusqueda('');
    setPresupuesto(null);
    setSoloDisponibles(false);
    setOrden('recomendado');
    setMostrarSugerencias(false);
  };

  const valorSlider = presupuesto ?? rango?.max ?? 0;
  const pct = rango ? ((valorSlider - rango.min) / (rango.max - rango.min)) * 100 : 100;
  const etiquetaTipo = montoTipo === 'apartado' ? 'apartado' : 'enganche';

  const chips: { label: string; quitar: () => void }[] = [];
  if (busqueda) chips.push({ label: `“${busqueda}”`, quitar: () => setBusqueda('') });
  if (presupuesto !== null)
    chips.push({ label: `${etiquetaTipo === 'apartado' ? 'Apartado' : 'Enganche'} hasta ${fmt(presupuesto)}`, quitar: () => setPresupuesto(null) });
  if (soloDisponibles) chips.push({ label: 'Con lotes disponibles', quitar: () => setSoloDisponibles(false) });
  const hayFiltros = chips.length > 0 || orden !== 'recomendado';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
      {/* Buscador: black brand panel so it stands out from the page background */}
      <section className="bg-marca-negro rounded-2xl px-4 py-3 md:px-5 mb-5 shadow-lg">
        {/* Greeting and search share one row on wide screens */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6 mb-3">
        <div className="lg:shrink-0">
          <h1 className="text-lg md:text-xl font-bold text-white leading-tight">
            {isAuthenticated ? `Bienvenido, ${userName ?? 'Cliente'}` : 'Encuentra tu lote ideal'}
          </h1>
          <p className="text-xs md:text-sm text-gray-400">
            {isAuthenticated
              ? 'Explora nuestros desarrollos y aparta en línea.'
              : 'Busca por desarrollo o ubicación y ajusta el monto a tu presupuesto.'}
          </p>
        </div>

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-0" ref={busquedaRef}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-marca-oro w-5 h-5 pointer-events-none" />
          <input
            type="search"
            role="combobox"
            aria-expanded={mostrarSugerencias && sugerencias.length > 0}
            aria-controls="sugerencias-desarrollos"
            aria-label="Buscar desarrollo o ubicación"
            placeholder="Buscar desarrollo o ubicación…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setMostrarSugerencias(true);
              setSugerenciaActiva(-1);
            }}
            onFocus={() => setMostrarSugerencias(true)}
            onKeyDown={onTeclaBusqueda}
            className="w-full pl-12 pr-11 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 rounded-xl border-2 border-transparent focus:border-marca-oro focus:outline-none shadow-sm [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Borrar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {mostrarSugerencias && sugerencias.length > 0 && (
            <ul
              id="sugerencias-desarrollos"
              role="listbox"
              className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
            >
              {sugerencias.map((s, i) => (
                <li key={s} role="option" aria-selected={i === sugerenciaActiva}>
                  <button
                    type="button"
                    onMouseDown={() => elegirSugerencia(s)}
                    className={`w-full text-left px-4 py-2.5 text-sm text-gray-800 flex items-center gap-2 ${
                      i === sugerenciaActiva ? 'bg-teal-50' : 'hover:bg-teal-50'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 lg:gap-8 items-center">
          {/* Presupuesto con barra deslizable */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-marca-oro" />
                <span className="text-sm font-medium text-white">Tu presupuesto para</span>
                <div className="inline-flex bg-white/10 rounded-full p-0.5" role="group" aria-label="Tipo de monto">
                  {(['apartado', 'enganche'] as MontoTipo[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => cambiarTipo(tipo)}
                      aria-pressed={montoTipo === tipo}
                      className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                        montoTipo === tipo ? 'bg-marca-oro text-marca-negro' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      {tipo === 'apartado' ? 'Apartado' : 'Enganche'}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-base font-bold text-marca-oro tabular-nums" aria-live="polite">
                {presupuesto === null ? 'Cualquier monto' : `Hasta ${fmt(presupuesto)}`}
              </span>
            </div>

            {rango ? (
              // Range ends sit beside the slider instead of on a line below it.
              <div className="flex items-center gap-3 text-xs text-gray-400 tabular-nums">
                <span className="shrink-0">{fmt(rango.min)}</span>
                <input
                  type="range"
                  min={rango.min}
                  max={rango.max}
                  step={rango.paso}
                  value={valorSlider}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPresupuesto(v >= rango.max ? null : v);
                  }}
                  aria-label={`Monto máximo de ${etiquetaTipo}`}
                  aria-valuetext={presupuesto === null ? 'Cualquier monto' : `Hasta ${fmt(presupuesto)}`}
                  className="rango-monto"
                  style={{ ['--pct' as string]: `${pct}%` }}
                />
                <span className="shrink-0">{fmt(rango.max)}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Aún no hay montos de {etiquetaTipo} publicados.</p>
            )}
          </div>

          {/* Orden y disponibilidad */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 sm:items-center lg:items-stretch xl:items-center">
            <label className="relative flex items-center">
              <span className="sr-only">Ordenar desarrollos</span>
              <ArrowUpDown className="absolute left-3 w-4 h-4 text-marca-oro pointer-events-none" />
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="w-full appearance-none bg-white/10 text-white text-sm rounded-xl pl-9 pr-8 py-2 border border-white/15 hover:border-white/30 focus:border-marca-oro focus:outline-none cursor-pointer [&>option]:text-gray-900"
              >
                <option value="recomendado">Recomendados</option>
                <option value="apartado">Menor apartado</option>
                <option value="enganche">Menor enganche</option>
                <option value="disponibles">Más lotes disponibles</option>
              </select>
              <span className="absolute right-3 text-gray-400 pointer-events-none text-xs">▾</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-white whitespace-nowrap">
              <span className="relative inline-flex">
                <input
                  type="checkbox"
                  checked={soloDisponibles}
                  onChange={(e) => setSoloDisponibles(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="w-10 h-6 rounded-full bg-white/20 peer-checked:bg-marca-oro transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-marca-oro peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-marca-negro" />
                <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
              Solo con lotes disponibles
            </label>
          </div>
        </div>
      </section>

      {/* Resultados */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-gray-800 mr-1">
          Desarrollos
          {!isLoading && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {developments.length} de {allDevelopments.length}
            </span>
          )}
        </h2>
        {chips.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium pl-3 pr-1.5 py-1 rounded-full"
          >
            {c.label}
            <button
              type="button"
              onClick={c.quitar}
              aria-label={`Quitar filtro ${c.label}`}
              className="p-0.5 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="text-xs font-semibold text-teal-700 hover:underline ml-1">
            Limpiar todo
          </button>
        )}
      </div>

      <div className="mb-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : developments.length > 0 ? (
          <div className="space-y-4">
            {developments.map((development) => (
              <DevelopmentCard key={development.id} development={development} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl px-6 py-10 text-center">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-800">No encontramos desarrollos con estos filtros</p>
            {montoParaVerMas !== null ? (
              <p className="text-sm text-gray-600 mt-1">
                El {etiquetaTipo} más accesible es de {fmt(montoParaVerMas)}.{' '}
                <button
                  type="button"
                  onClick={() => setPresupuesto(rango && montoParaVerMas >= rango.max ? null : montoParaVerMas)}
                  className="font-semibold text-teal-700 underline"
                >
                  Ajustar a ese monto
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-600 mt-1">Prueba con otra búsqueda o quita algunos filtros.</p>
            )}
            <button
              type="button"
              onClick={limpiar}
              className="mt-4 inline-flex items-center gap-1.5 bg-marca-negro text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-marca-carbon"
            >
              <X className="w-4 h-4" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-8">
          <Link
            to="/mis-lotes"
            className="group bg-marca-negro text-white rounded-2xl p-5 md:p-6 border-l-4 border-marca-oro hover:shadow-lg hover:bg-marca-carbon transition block"
          >
            <h3 className="text-xl font-semibold mb-2 text-marca-oro">Ver mis lotes</h3>
            <p className="text-gray-300 text-sm">Consulta el estado de tus apartados y avance de compra.</p>
          </Link>

          <Link
            to="/mis-pagos"
            className="bg-marca-oro text-marca-negro rounded-2xl p-5 md:p-6 hover:shadow-lg hover:brightness-105 transition block"
          >
            <h3 className="text-xl font-semibold mb-2">Mis pagos</h3>
            <p className="text-marca-negro/80 text-sm">Revisa tu calendario de pagos e historial.</p>
          </Link>
        </div>
      )}
    </div>
  );
}
