import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/utils/helpers'
import {
  cerrarSaldoFavor,
  esDecisionYaRegistrada,
  fetchSaldoFavorCierres,
  fetchSaldoFavorDisponible,
  QUIEN_DECIDE_SALDO_FAVOR,
} from '@/utils/pagos'
import type { SaldoFavorCierre, SaldoFavorDecision } from '@/types/database'

const OPCIONES: { value: SaldoFavorDecision; label: string; detalle: string }[] = [
  { value: 'reembolso', label: 'Reembolsar al cliente', detalle: 'Se registra una devolución por el saldo, en un solo pago.' },
  { value: 'retencion', label: 'Retener', detalle: 'Queda registrado quién lo decidió y cuándo.' },
]

/**
 * The question "what happens to this sale's saldo a favor?" with its two
 * options and an optional note. Used in the cancel dialog and in the pending
 * notice of an already-cancelled sale.
 */
export function SaldoFavorDecisionFields({
  monto,
  decision,
  nota,
  onChange,
  disabled = false,
}: {
  monto: number
  decision: SaldoFavorDecision | null
  nota: string
  onChange: (decision: SaldoFavorDecision | null, nota: string) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-semibold text-gray-800">
        Esta venta tiene {formatCurrency(monto)} de saldo a favor. ¿Qué se hace con él?
      </legend>
      <div className="space-y-2">
        {OPCIONES.map((opcion) => (
          <label
            key={opcion.value}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
              decision === opcion.value ? 'border-[#142127] bg-[#f7f8f8]' : 'border-gray-200 bg-white'
            }`}
          >
            <input
              type="radio"
              name="saldo-favor-decision"
              value={opcion.value}
              checked={decision === opcion.value}
              onChange={() => onChange(opcion.value, nota)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{opcion.label}</span>
              <span className="block text-xs text-gray-500">{opcion.detalle}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="block">
        <span className="text-xs text-gray-600">Nota (opcional)</span>
        <textarea
          value={nota}
          onChange={(e) => onChange(decision, e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ej. el cliente lo pidió en efectivo"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
    </fieldset>
  )
}

/**
 * For a cancelled sale: the decisions taken about its saldo a favor and, when
 * it still has undecided saldo, a pending notice where staff with permission
 * can decide. Renders nothing when there is neither.
 */
export function SaldoFavorCierrePanel({
  ventaid,
  puedeDecidir,
  onDecidido,
}: {
  ventaid: number
  puedeDecidir: boolean
  onDecidido: () => void
}) {
  const [cierres, setCierres] = useState<SaldoFavorCierre[]>([])
  const [saldo, setSaldo] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [decision, setDecision] = useState<SaldoFavorDecision | null>(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Blocks a second click before the disabled button re-renders.
  const guardandoRef = useRef(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const [encontrados, pendiente] = await Promise.all([
        fetchSaldoFavorCierres(ventaid),
        fetchSaldoFavorDisponible(ventaid),
      ])
      setCierres(encontrados)
      setSaldo(pendiente)
    } catch (err) {
      console.error('Error al cargar el saldo a favor de la venta:', err)
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [ventaid])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!decision || guardandoRef.current) return
    guardandoRef.current = true
    setGuardando(true)
    setError(null)
    try {
      await cerrarSaldoFavor(ventaid, decision, nota)
    } catch (err) {
      // Someone else (or a second click) already recorded it: just show it.
      if (!esDecisionYaRegistrada(err)) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la decisión.')
        guardandoRef.current = false
        setGuardando(false)
        return
      }
    }
    setDecision(null)
    setNota('')
    await cargar()
    onDecidido()
    guardandoRef.current = false
    setGuardando(false)
  }

  if (cargando) return null

  if (errorCarga) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-[14px] p-4 mb-6 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
        <span>No se pudo revisar el saldo a favor de esta venta.</span>
        <Button variant="outline" size="sm" onClick={cargar}>Reintentar</Button>
      </div>
    )
  }

  if (cierres.length === 0 && saldo <= 0) return null

  return (
    <>
      {cierres.map((cierre) => (
        <div key={cierre.cierreid} className="bg-[#f7f8f8] border border-[#e0e5e7] rounded-[14px] p-4 mb-6 text-sm text-gray-700">
          {cierre.decision === 'reembolso'
            ? <>Saldo a favor de <strong>{formatCurrency(cierre.monto)}</strong>: reembolsado (Devolución #{cierre.devolucionid}).</>
            : <>Saldo a favor de <strong>{formatCurrency(cierre.monto)}</strong>: retenido por {cierre.created_by_nombre} el {formatDate(cierre.created_at)}.</>}
          {cierre.nota && <p className="mt-1 text-gray-500">Nota: {cierre.nota}</p>}
        </div>
      ))}

      {saldo > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-[14px] p-4 mb-6 space-y-3">
          <p className="font-semibold text-amber-900">Saldo a favor pendiente de decidir: {formatCurrency(saldo)}</p>
          {puedeDecidir ? (
            <>
              <SaldoFavorDecisionFields
                monto={saldo}
                decision={decision}
                nota={nota}
                onChange={(d, n) => { setDecision(d); setNota(n) }}
                disabled={guardando}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end">
                <Button onClick={guardar} disabled={!decision || guardando}>
                  {guardando ? 'Guardando…' : 'Guardar decisión'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-800">La decisión la toma {QUIEN_DECIDE_SALDO_FAVOR}.</p>
          )}
        </div>
      )}
    </>
  )
}
