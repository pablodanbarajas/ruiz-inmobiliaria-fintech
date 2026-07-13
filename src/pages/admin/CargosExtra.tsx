import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getCached, setCached } from '@/lib/queryCache'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { CargoExtra, Desarrollo, Lote } from '@/types/database'
import { formatDate, formatCurrency } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

interface CargoExtraWithDetails extends CargoExtra {
  lote?: Lote & { desarrollo?: Desarrollo }
}

interface AplicarCargoForm {
  desarrolloid: string
  concepto: string
  monto: string
  fecha: string
  fecha_fin: string
  aplicarATodos: boolean
  lotesSeleccionados: number[]
}

interface CancelarForm {
  desarrolloid: string
  concepto: string
  aplicarATodos: boolean
  lotesSeleccionados: number[]
}

const today = () => new Date().toISOString().split('T')[0]

const ESTATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'P', label: 'Pendiente' },
  { value: 'C', label: 'Cobrado' },
  { value: 'X', label: 'Cancelado' },
]

const getCargoStatusLabel = (s: string | null) => {
  switch (s) {
    case 'C': return 'Cobrado'
    case 'X': return 'Cancelado'
    default:  return 'Pendiente'
  }
}

const getCargoStatusColor = (s: string | null) => {
  switch (s) {
    case 'C': return 'bg-green-100 text-green-800'
    case 'X': return 'bg-red-100 text-red-600'
    default:  return 'bg-amber-100 text-amber-800'
  }
}

export const CargosExtra = () => {
  // ── Master list state ─────────────────────────────────────────
  const [cargos, setCargos] = useState<CargoExtraWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 15

  const [filters, setFilters] = usePersistedFilters('cargosExtraFilters', { estatus: '', concepto: '', desarrolloNombre: '' })

  // ── Apply-to-desarrollo modal state ──────────────────────────
  const [showAplicarModal, setShowAplicarModal] = useState(false)
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [aplicarForm, setAplicarForm] = useState<AplicarCargoForm>({
    desarrolloid: '',
    concepto: '',
    monto: '',
    fecha: today(),
    fecha_fin: '',
    aplicarATodos: true,
    lotesSeleccionados: [],
  })
  const [lotesPreview, setLotesPreview] = useState<{ loteid: number; manzana: string | null; nolote: string | null; clavelote: string | null }[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Cancelar masivo modal state ───────────────────────────────
  const [showCancelarModal, setShowCancelarModal] = useState(false)
  const [cancelForm, setCancelForm] = useState<CancelarForm>({
    desarrolloid: '',
    concepto: '',
    aplicarATodos: true,
    lotesSeleccionados: [],
  })
  const [conceptosPendientes, setConceptosPendientes] = useState<string[]>([])
  const [lotesCancelables, setLotesCancelables] = useState<{ cargoid: number; loteid: number; manzana: string | null; nolote: string | null }[]>([])
  const [loadingCancelables, setLoadingCancelables] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // ── Fetch master list ─────────────────────────────────────────
  const fetchCargos = async (bypass = false) => {
    const ck = `cargos:${JSON.stringify(filters)}:${currentPage}`
    if (!bypass) { const c = getCached<{ items: CargoExtraWithDetails[]; total: number }>(ck); if (c) { setCargos(c.items); setTotalItems(c.total); setLoading(false); return } }
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cargos_extra')
        .select('*, lote:lote(loteid, manzana, nolote, clavelote, desarrollo:desarrollo(desarrolloid, nombre))')
        .order('fecha', { ascending: false })

      if (error) throw error

      let list = (data || []) as CargoExtraWithDetails[]

      if (DEMO_DESARROLLOIDS.length > 0) {
        list = list.filter((c) => {
          const dev = c.lote?.desarrollo
          const devId = (Array.isArray(dev) ? dev[0] : dev)?.desarrolloid
          return DEMO_DESARROLLOIDS.includes(devId)
        })
      }

      if (filters.estatus) {
        list = list.filter((c) => c.estatus === filters.estatus)
      }
      if (filters.concepto) {
        const term = filters.concepto.toLowerCase()
        list = list.filter((c) => c.concepto?.toLowerCase().includes(term))
      }
      if (filters.desarrolloNombre) {
        const term = filters.desarrolloNombre.toLowerCase()
        list = list.filter((c) =>
          c.lote?.desarrollo?.nombre?.toLowerCase().includes(term)
        )
      }

      setTotalItems(list.length)
      const start = (currentPage - 1) * itemsPerPage
      const page = list.slice(start, start + itemsPerPage)
      setCached(ck, { items: page, total: list.length })
      setCargos(page)
    } catch (err) {
      console.error('Error fetching cargos extra:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch desarrollos for modal dropdown
  const fetchDesarrollos = async () => {
    const { data } = await supabase
      .from('desarrollo')
      .select('desarrolloid, nombre, clavedesarrollo')
      .eq('estatus', 'A')
      .order('nombre')
    const all = (data || []) as Desarrollo[]
    setDesarrollos(
      DEMO_DESARROLLOIDS.length > 0
        ? all.filter((d) => DEMO_DESARROLLOIDS.includes(d.desarrolloid))
        : all
    )
  }

  useEffect(() => { fetchCargos() }, [filters, currentPage])
  useEffect(() => { fetchDesarrollos() }, [])

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [filters])

  // ── Preview lotes when desarrollo selected (apply modal) ─────
  useEffect(() => {
    const desarrolloid = parseInt(aplicarForm.desarrolloid)
    if (!desarrolloid) { setLotesPreview([]); return }

    setLoadingPreview(true)
    supabase
      .from('lote')
      .select('loteid, manzana, nolote, clavelote')
      .eq('desarrolloid', desarrolloid)
      .order('manzana')
      .then(({ data }) => {
        const lotes = (data || []) as any[]
        setLotesPreview(lotes)
        // Reset selection — default all checked
        setAplicarForm((f) => ({ ...f, lotesSeleccionados: lotes.map((l) => l.loteid) }))
        setLoadingPreview(false)
      })
  }, [aplicarForm.desarrolloid])

  // ── Load conceptos pendientes when cancel modal desarrollo changes ──
  useEffect(() => {
    const desarrolloid = parseInt(cancelForm.desarrolloid)
    if (!desarrolloid) { setConceptosPendientes([]); setLotesCancelables([]); return }
    supabase
      .from('cargos_extra')
      .select('concepto')
      .eq('desarrolloid', desarrolloid)
      .eq('estatus', 'P')
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((r: any) => r.concepto as string))].sort()
        setConceptosPendientes(unique)
        setCancelForm((f) => ({ ...f, concepto: '', lotesSeleccionados: [], aplicarATodos: true }))
      })
  }, [cancelForm.desarrolloid])

  // ── Load lotes cancelables when concepto changes ─────────────
  useEffect(() => {
    const desarrolloid = parseInt(cancelForm.desarrolloid)
    if (!desarrolloid || !cancelForm.concepto) { setLotesCancelables([]); return }
    setLoadingCancelables(true)
    supabase
      .from('cargos_extra')
      .select('cargoid, loteid, lote:lote(manzana, nolote)')
      .eq('desarrolloid', desarrolloid)
      .eq('concepto', cancelForm.concepto)
      .eq('estatus', 'P')
      .then(({ data }) => {
        const rows = (data || []).map((r: any) => ({
          cargoid: r.cargoid,
          loteid: r.loteid,
          manzana: r.lote?.manzana ?? null,
          nolote: r.lote?.nolote ?? null,
        }))
        setLotesCancelables(rows)
        setCancelForm((f) => ({ ...f, lotesSeleccionados: rows.map((r) => r.cargoid), aplicarATodos: true }))
        setLoadingCancelables(false)
      })
  }, [cancelForm.concepto, cancelForm.desarrolloid])

  // ── Validate + submit apply-to-desarrollo ────────────────────
  const validateAplicar = () => {
    const e: Record<string, string> = {}
    if (!aplicarForm.desarrolloid) e.desarrolloid = 'Selecciona un desarrollo'
    if (!aplicarForm.concepto.trim()) e.concepto = 'El concepto es requerido'
    const monto = parseFloat(aplicarForm.monto)
    if (isNaN(monto) || monto <= 0) e.monto = 'Ingresa un monto válido mayor a 0'
    if (!aplicarForm.fecha) e.fecha = 'La fecha de inicio es requerida'
    if (aplicarForm.fecha_fin && aplicarForm.fecha_fin <= aplicarForm.fecha)
      e.fecha_fin = 'La fecha de fin debe ser posterior a la fecha de inicio'
    if (lotesPreview.length === 0) e.desarrolloid = 'No hay lotes registrados en este desarrollo'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCancelarMasivo = async () => {
    const ids = cancelForm.aplicarATodos
      ? lotesCancelables.map((r) => r.cargoid)
      : cancelForm.lotesSeleccionados
    if (ids.length === 0) return
    if (!window.confirm(`¿Cancelar ${ids.length} cargo${ids.length !== 1 ? 's' : ''} de "${cancelForm.concepto}"? Esta acción no se puede deshacer.`)) return
    setIsCancelling(true)
    try {
      const { error } = await supabase
        .from('cargos_extra')
        .update({ estatus: 'X' })
        .in('cargoid', ids)
      if (error) throw error
      setShowCancelarModal(false)
      setCancelForm({ desarrolloid: '', concepto: '', aplicarATodos: true, lotesSeleccionados: [] })
      fetchCargos()
    } catch (err: any) {
      alert(`Error al cancelar: ${err.message}`)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleAplicarCargo = async () => {
    if (!validateAplicar()) return
    try {
      setIsSubmitting(true)
      const monto = parseFloat(parseFloat(aplicarForm.monto).toFixed(2))
      const loteIds = aplicarForm.aplicarATodos
        ? lotesPreview.map((l) => l.loteid)
        : aplicarForm.lotesSeleccionados

      // Deduplication: skip lotes that already have a non-cancelled cargo with this concepto
      const { data: existing } = await supabase
        .from('cargos_extra')
        .select('loteid')
        .in('loteid', loteIds)
        .eq('concepto', aplicarForm.concepto.trim())
        .neq('estatus', 'X')

      const existingSet = new Set((existing || []).map((r: any) => r.loteid))
      const nuevosLoteIds = loteIds.filter((lid) => !existingSet.has(lid))

      if (nuevosLoteIds.length === 0) {
        alert('Todos los lotes de este desarrollo ya tienen este cargo registrado.')
        setIsSubmitting(false)
        return
      }

      const registros = nuevosLoteIds.map((lid) => ({
        loteid: lid,
        desarrolloid: parseInt(aplicarForm.desarrolloid),
        concepto: aplicarForm.concepto.trim(),
        monto,
        fecha: aplicarForm.fecha,
        fecha_fin: aplicarForm.fecha_fin || null,
        estatus: 'P',
      }))

      const { error } = await supabase.from('cargos_extra').insert(registros)
      if (error) throw error

      const omitidos = existingSet.size
      setShowAplicarModal(false)
      setAplicarForm({ desarrolloid: '', concepto: '', monto: '', fecha: today(), fecha_fin: '', aplicarATodos: true, lotesSeleccionados: [] })
      setLotesPreview([])
      fetchCargos()
      if (omitidos > 0) {
        alert(`Cargo aplicado a ${nuevosLoteIds.length} lote${nuevosLoteIds.length !== 1 ? 's' : ''}. Se omitieron ${omitidos} lote${omitidos !== 1 ? 's' : ''} que ya tenían este cargo registrado.`)
      }
    } catch (err: any) {
      alert(`Error al aplicar cargos: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Mark individual cargo as cobrado / cancelled ──────────────
  const handleSetEstatus = async (cargoid: number, estatus: 'C' | 'X') => {
    const { error } = await supabase
      .from('cargos_extra')
      .update({
        estatus,
        fecha_pago: estatus === 'C' ? today() : null,
      })
      .eq('cargoid', cargoid)
    if (!error) fetchCargos()
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const sectionHeading = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl md:text-4xl font-bold text-black"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Cargos Extra
            </h1>
            <p className="text-gray-500 mt-1">
              Cargos adicionales por servicios aplicados a ventas por desarrollo
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCancelarModal(true)}
              className="inline-flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
            >
              <XCircle size={16} />
              Cancelar cargos
            </Button>
            <Button
              onClick={() => setShowAplicarModal(true)}
              className="inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Aplicar cargo a desarrollo
            </Button>
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">Concepto</label>
            <Input
              placeholder="Buscar concepto…"
              value={filters.concepto}
              onChange={(e) => setFilters({ ...filters, concepto: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">Desarrollo</label>
            <Input
              placeholder="Buscar desarrollo…"
              value={filters.desarrolloNombre}
              onChange={(e) => setFilters({ ...filters, desarrolloNombre: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estatus</label>
            <select
              value={filters.estatus}
              onChange={(e) => setFilters({ ...filters, estatus: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
            >
              {ESTATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Cargando…</div>
          ) : cargos.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No se encontraron cargos extra
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Desarrollo · Lote</th>
                    <th className="px-6 py-3">Concepto</th>
                    <th className="px-6 py-3">Monto</th>
                    <th className="px-6 py-3">Fecha inicio</th>
                    <th className="px-6 py-3">Fecha fin</th>
                    <th className="px-6 py-3">Estatus</th>
                    <th className="px-6 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cargos.map((cargo) => (
                    <tr key={cargo.cargoid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-700">
                        <span className="font-medium">
                          {cargo.lote?.desarrollo?.nombre || '—'}
                        </span>
                        {cargo.lote && (
                          <span className="text-gray-400 ml-1">
                            · Mza {cargo.lote.manzana} L{cargo.lote.nolote}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{cargo.concepto}</td>
                      <td className="px-6 py-4 font-semibold text-[#504840]">
                        {formatCurrency(cargo.monto)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(cargo.fecha)}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {cargo.fecha_fin ? formatDate(cargo.fecha_fin) : <span className="text-gray-300">Sin límite</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getCargoStatusColor(cargo.estatus)}`}
                        >
                          {getCargoStatusLabel(cargo.estatus)}
                        </span>
                        {cargo.fecha_pago && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(cargo.fecha_pago)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {cargo.estatus === 'P' && (
                            <>
                              <Button
                                variant="ghost"
                                className="p-1 text-green-600 hover:bg-green-50"
                                title="Marcar como cobrado"
                                onClick={() => handleSetEstatus(cargo.cargoid, 'C')}
                              >
                                <CheckCircle2 size={15} />
                              </Button>
                              <Button
                                variant="ghost"
                                className="p-1 text-red-500 hover:bg-red-50"
                                title="Cancelar cargo"
                                onClick={() => {
                                  if (window.confirm(`¿Cancelar el cargo "${cargo.concepto}"? Esta acción no se puede deshacer.`)) {
                                    handleSetEstatus(cargo.cargoid, 'X')
                                  }
                                }}
                              >
                                <XCircle size={15} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
              <span>
                {totalItems} cargos · página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft size={14} /> Anterior
                </Button>
                <Button
                  variant="outline"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Siguiente <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Aplicar cargo a desarrollo ──────────────── */}
      <Modal
        isOpen={showAplicarModal}
        title="Aplicar cargo extra a desarrollo"
        onClose={() => !isSubmitting && setShowAplicarModal(false)}
        size="xl"
      >
        <div className="space-y-6">
          {/* Selección de desarrollo */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className={sectionHeading}>Seleccionar desarrollo</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desarrollo <span className="text-red-500">*</span>
              </label>
              <select
                value={aplicarForm.desarrolloid}
                onChange={(e) =>
                  setAplicarForm({ ...aplicarForm, desarrolloid: e.target.value })
                }
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] disabled:bg-gray-100"
              >
                <option value="">— Selecciona un desarrollo —</option>
                {desarrollos.map((d) => (
                  <option key={d.desarrolloid} value={d.desarrolloid}>
                    {d.nombre}
                    {d.clavedesarrollo ? ` (${d.clavedesarrollo})` : ''}
                  </option>
                ))}
              </select>
              {formErrors.desarrolloid && (
                <p className="text-red-500 text-xs mt-1">{formErrors.desarrolloid}</p>
              )}
            </div>

            {/* Lote selection */}
            {aplicarForm.desarrolloid && (
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                {loadingPreview ? (
                  <p className="text-sm text-gray-500">Cargando lotes…</p>
                ) : lotesPreview.length === 0 ? (
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <AlertTriangle size={15} />
                    No hay lotes registrados en este desarrollo
                  </div>
                ) : (
                  <>
                    {/* Toggle todos / seleccionar */}
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={aplicarForm.aplicarATodos}
                          onChange={() => setAplicarForm((f) => ({ ...f, aplicarATodos: true, lotesSeleccionados: lotesPreview.map((l) => l.loteid) }))}
                          className="accent-[#eaae4c]"
                        />
                        <span className="font-medium">Todos los lotes ({lotesPreview.length})</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!aplicarForm.aplicarATodos}
                          onChange={() => setAplicarForm((f) => ({ ...f, aplicarATodos: false }))}
                          className="accent-[#eaae4c]"
                        />
                        <span className="font-medium">Seleccionar lotes específicos</span>
                      </label>
                    </div>

                    {/* Checkbox list when specific */}
                    {!aplicarForm.aplicarATodos && (
                      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded p-2 space-y-1">
                        <label className="flex items-center gap-2 text-xs text-gray-500 pb-1 border-b border-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-[#eaae4c]"
                            checked={aplicarForm.lotesSeleccionados.length === lotesPreview.length}
                            onChange={(e) => setAplicarForm((f) => ({
                              ...f,
                              lotesSeleccionados: e.target.checked ? lotesPreview.map((l) => l.loteid) : [],
                            }))}
                          />
                          Seleccionar todos
                        </label>
                        {lotesPreview.map((l) => (
                          <label key={l.loteid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                            <input
                              type="checkbox"
                              className="accent-[#eaae4c]"
                              checked={aplicarForm.lotesSeleccionados.includes(l.loteid)}
                              onChange={(e) => setAplicarForm((f) => ({
                                ...f,
                                lotesSeleccionados: e.target.checked
                                  ? [...f.lotesSeleccionados, l.loteid]
                                  : f.lotesSeleccionados.filter((id) => id !== l.loteid),
                              }))}
                            />
                            Mza {l.manzana} · Lote {l.nolote}
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      {(aplicarForm.aplicarATodos ? lotesPreview.length : aplicarForm.lotesSeleccionados.length)} lote{(aplicarForm.aplicarATodos ? lotesPreview.length : aplicarForm.lotesSeleccionados.length) !== 1 ? 's' : ''} seleccionado{(aplicarForm.aplicarATodos ? lotesPreview.length : aplicarForm.lotesSeleccionados.length) !== 1 ? 's' : ''}.
                      Los que ya tengan este cargo serán omitidos automáticamente.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Datos del cargo */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className={sectionHeading}>Datos del cargo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concepto <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Ej: Mantenimiento, Agua, Seguridad…"
                  value={aplicarForm.concepto}
                  onChange={(e) =>
                    setAplicarForm({ ...aplicarForm, concepto: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                {formErrors.concepto && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.concepto}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={aplicarForm.monto}
                  onChange={(e) =>
                    setAplicarForm({ ...aplicarForm, monto: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                {formErrors.monto && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.monto}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de inicio <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={aplicarForm.fecha}
                  onChange={(e) =>
                    setAplicarForm({ ...aplicarForm, fecha: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                {formErrors.fecha && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.fecha}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de fin{' '}
                  <span className="text-gray-400 font-normal">(opcional — vacío = sin límite)</span>
                </label>
                <Input
                  type="date"
                  value={aplicarForm.fecha_fin}
                  min={aplicarForm.fecha || undefined}
                  onChange={(e) =>
                    setAplicarForm({ ...aplicarForm, fecha_fin: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                {formErrors.fecha_fin && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.fecha_fin}</p>
                )}
              </div>
            </div>

            {/* Cost summary */}
            {(() => {
              const count = aplicarForm.aplicarATodos ? lotesPreview.length : aplicarForm.lotesSeleccionados.length
              return count > 0 && parseFloat(aplicarForm.monto) > 0 ? (
                <div className="bg-[#eaae4c]/10 border border-[#eaae4c] rounded-lg p-3 flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    A registrar:{' '}
                    <span className="font-bold text-[#504840]">
                      {count} lote{count !== 1 ? 's' : ''} × {formatCurrency(parseFloat(aplicarForm.monto))}
                    </span>
                  </span>
                  <span className="font-bold text-[#504840]">
                    = {formatCurrency(count * parseFloat(aplicarForm.monto))}
                  </span>
                </div>
              ) : null
            })()}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowAplicarModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAplicarCargo}
              disabled={isSubmitting || (aplicarForm.aplicarATodos ? lotesPreview.length === 0 : aplicarForm.lotesSeleccionados.length === 0)}
              className="inline-flex items-center gap-2"
            >
              <Plus size={15} />
              {isSubmitting ? 'Aplicando…' : (() => {
                const n = aplicarForm.aplicarATodos ? lotesPreview.length : aplicarForm.lotesSeleccionados.length
                return `Aplicar a ${n} lote${n !== 1 ? 's' : ''}`
              })()}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Cancelar cargos masivo ─────────────────── */}
      <Modal
        isOpen={showCancelarModal}
        title="Cancelar cargos extra"
        onClose={() => !isCancelling && setShowCancelarModal(false)}
        size="xl"
      >
        <div className="space-y-5">
          {/* Desarrollo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desarrollo <span className="text-red-500">*</span>
            </label>
            <select
              value={cancelForm.desarrolloid}
              onChange={(e) => setCancelForm((f) => ({ ...f, desarrolloid: e.target.value, concepto: '', lotesSeleccionados: [], aplicarATodos: true }))}
              disabled={isCancelling}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] disabled:bg-gray-100"
            >
              <option value="">— Selecciona un desarrollo —</option>
              {desarrollos.map((d) => (
                <option key={d.desarrolloid} value={d.desarrolloid}>
                  {d.nombre}{d.clavedesarrollo ? ` (${d.clavedesarrollo})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Concepto */}
          {cancelForm.desarrolloid && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto (cargo) <span className="text-red-500">*</span>
              </label>
              {conceptosPendientes.length === 0 ? (
                <p className="text-sm text-gray-400">No hay cargos pendientes en este desarrollo.</p>
              ) : (
                <select
                  value={cancelForm.concepto}
                  onChange={(e) => setCancelForm((f) => ({ ...f, concepto: e.target.value, lotesSeleccionados: [], aplicarATodos: true }))}
                  disabled={isCancelling}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] disabled:bg-gray-100"
                >
                  <option value="">— Selecciona un concepto —</option>
                  {conceptosPendientes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Lote selection */}
          {cancelForm.concepto && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              {loadingCancelables ? (
                <p className="text-sm text-gray-500">Cargando lotes…</p>
              ) : lotesCancelables.length === 0 ? (
                <p className="text-sm text-amber-700">No se encontraron cargos pendientes con este concepto.</p>
              ) : (
                <>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={cancelForm.aplicarATodos}
                        onChange={() => setCancelForm((f) => ({ ...f, aplicarATodos: true, lotesSeleccionados: lotesCancelables.map((r) => r.cargoid) }))}
                        className="accent-[#eaae4c]"
                      />
                      <span className="font-medium">Todos los lotes ({lotesCancelables.length})</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!cancelForm.aplicarATodos}
                        onChange={() => setCancelForm((f) => ({ ...f, aplicarATodos: false, lotesSeleccionados: [] }))}
                        className="accent-[#eaae4c]"
                      />
                      <span className="font-medium">Seleccionar lotes específicos</span>
                    </label>
                  </div>

                  {!cancelForm.aplicarATodos && (
                    <div className="max-h-48 overflow-y-auto border border-gray-100 rounded bg-white p-2 space-y-1">
                      <label className="flex items-center gap-2 text-xs text-gray-500 pb-1 border-b border-gray-100 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-[#eaae4c]"
                          checked={cancelForm.lotesSeleccionados.length === lotesCancelables.length}
                          onChange={(e) => setCancelForm((f) => ({
                            ...f,
                            lotesSeleccionados: e.target.checked ? lotesCancelables.map((r) => r.cargoid) : [],
                          }))}
                        />
                        Seleccionar todos
                      </label>
                      {lotesCancelables.map((r) => (
                        <label key={r.cargoid} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                          <input
                            type="checkbox"
                            className="accent-[#eaae4c]"
                            checked={cancelForm.lotesSeleccionados.includes(r.cargoid)}
                            onChange={(e) => setCancelForm((f) => ({
                              ...f,
                              lotesSeleccionados: e.target.checked
                                ? [...f.lotesSeleccionados, r.cargoid]
                                : f.lotesSeleccionados.filter((id) => id !== r.cargoid),
                            }))}
                          />
                          Mza {r.manzana} · Lote {r.nolote}
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                    Se cancelarán{' '}
                    <strong>{cancelForm.aplicarATodos ? lotesCancelables.length : cancelForm.lotesSeleccionados.length}</strong>
                    {' '}cargo{(cancelForm.aplicarATodos ? lotesCancelables.length : cancelForm.lotesSeleccionados.length) !== 1 ? 's' : ''} de &quot;{cancelForm.concepto}&quot;.
                    Esta acción no se puede deshacer.
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCancelarModal(false)} disabled={isCancelling}>
              Cerrar
            </Button>
            <Button
              onClick={handleCancelarMasivo}
              disabled={isCancelling || !cancelForm.concepto || (cancelForm.aplicarATodos ? lotesCancelables.length === 0 : cancelForm.lotesSeleccionados.length === 0)}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle size={15} />
              {isCancelling ? 'Cancelando…' : 'Confirmar cancelación'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
