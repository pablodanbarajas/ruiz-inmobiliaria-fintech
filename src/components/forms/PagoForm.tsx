import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import type { Pago, CorridaFinanciera, Cliente, Lote, CargoExtra } from '@/types/database'
import {
  formatDate,
  formatCurrency,
  getPagoStatusLabel,
  getPagoStatusColor,
  FORMAS_PAGO,
  calcularRecargo,
} from '@/utils/helpers'
import { AlertTriangle, Info } from 'lucide-react'

export interface PagoFormData {
  corridafinancieraid: number | null
  fechapago: string
  montopagado: number
  formapago: number
  estatus: string
  referencia: string | null
  comentario: string | null
  recargo: number
  cobrador: string | null
}

interface PagoFormProps {
  /** Pre-selected corrida (from VentaDetail "Registrar Pago" button) */
  initialCorridaId?: number
  /** Existing pago for edit mode */
  pago?: Pago
  /** Days of tolerance before recargo applies (set per venta by admin) */
  diasTolerancia?: number
  /** Cargos extra de la venta (para calcular el total correcto incluyendo extras) */
  cargosExtra?: CargoExtra[]
  onSubmit: (data: PagoFormData) => Promise<void>
  isLoading?: boolean
}

interface VentaOption {
  ventaid: number
  label: string
  cliente?: Cliente
  lote?: Lote
}

interface CorridaWithPagos extends CorridaFinanciera {
  pagos?: Pago[]
  totalPagado?: number
  isPaid?: boolean
}

const today = () => new Date().toISOString().split('T')[0]

// ── PagoForm ───────────────────────────────────────────────────────
export const PagoForm = ({ initialCorridaId, pago, diasTolerancia = 0, cargosExtra = [], onSubmit, isLoading }: PagoFormProps) => {
  const isEditMode = !!pago

  // Venta search (only when no initialCorridaId and not edit mode)
  const [ventaOptions, setVentaOptions] = useState<ComboOption[]>([])
  const [selectedVentaId, setSelectedVentaId] = useState<string>('')
  const [loadingVentas, setLoadingVentas] = useState(false)

  // Corrida selection
  const [corridas, setCorridas] = useState<CorridaWithPagos[]>([])
  const [selectedCorrida, setSelectedCorrida] = useState<CorridaWithPagos | null>(null)
  const [loadingCorridas, setLoadingCorridas] = useState(false)

  // Form fields
  const [corridaId, setCorridaId] = useState<number | null>(initialCorridaId ?? pago?.corridafinancieraid ?? null)
  const [fechapago, setFechapago] = useState(pago?.fechapago ?? today())
  const [montopagado, setMontopagado] = useState<string>(pago?.montopagado != null ? String(pago.montopagado) : '')
  const [formapago, setFormapago] = useState<number>(pago?.formapago ?? 1)
  const [estatus, setEstatus] = useState(pago?.estatus ?? 'P')
  const [referencia, setReferencia] = useState(pago?.referencia ?? '')
  const [comentario, setComentario] = useState(pago?.comentario ?? '')
  const [recargo, setRecargo] = useState<number>(pago?.recargo ?? 0)
  const [cobrador, setCobrador] = useState<string>(pago?.cobrador ?? '')
  const [activeConvenio, setActiveConvenio] = useState<{ recargo_acordado: number | null; meses_atraso: number | null } | null>(null)
  const [checkingConvenio, setCheckingConvenio] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const needsVentaPicker = !isEditMode && !initialCorridaId

  // ── Total cargos extra aplicables a la corrida seleccionada ───
  const totalCargosExtraCorrida = useMemo(() => {
    if (!selectedCorrida || selectedCorrida.nopago === 0 || !cargosExtra.length) return 0
    return cargosExtra
      .filter(c => c.estatus !== 'X' && c.fecha != null && selectedCorrida.fecha != null && c.fecha <= selectedCorrida.fecha)
      .reduce((sum, c) => sum + (c.monto || 0), 0)
  }, [selectedCorrida, cargosExtra])

  // ── Load ventas for picker ──────────────────────────────────────
  useEffect(() => {
    if (!needsVentaPicker) return

    const loadVentas = async () => {
      setLoadingVentas(true)
      try {
        const allVentas: VentaOption[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from('venta')
            .select('ventaid, clienteid, loteid, estatus, cliente:cliente(clienteid, nombre), lote:lote(loteid, manzana, nolote, clavelote)')
            .neq('estatus', 'C')
            .order('ventaid', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1)

          if (error) throw error

          const items = (data || []).map((v: any) => ({
            ventaid: v.ventaid,
            label: `#${v.ventaid} — ${v.cliente?.nombre ?? 'Sin cliente'} | Mza ${v.lote?.manzana ?? '-'} Lote ${v.lote?.nolote ?? '-'}${v.lote?.clavelote ? ` (${v.lote.clavelote})` : ''}`,
            cliente: v.cliente,
            lote: v.lote,
          }))

          allVentas.push(...items)
          hasMore = (data || []).length === pageSize
          page++
        }

        const opts: ComboOption[] = allVentas.map((v) => ({ value: String(v.ventaid), label: v.label }))

        setVentaOptions(opts)
      } catch (err) {
        console.error('Error loading ventas:', err)
      } finally {
        setLoadingVentas(false)
      }
    }

    loadVentas()
  }, [needsVentaPicker])

  // ── Load corridas when venta is selected ───────────────────────
  useEffect(() => {
    if (!selectedVentaId) {
      setCorridas([])
      return
    }

    const loadCorridas = async () => {
      setLoadingCorridas(true)
      try {
        const { data: corridaData, error } = await supabase
          .from('corridafinanciera')
          .select('*')
          .eq('ventaid', selectedVentaId)
          .order('nopago', { ascending: true })

        if (error) throw error

        const corridasConPagos = await Promise.all(
          (corridaData || []).map(async (c) => {
            const { data: pagosData } = await supabase
              .from('pagos')
              .select('*')
              .eq('corridafinancieraid', c.corridafinancieraid)
              .neq('estatus', 'C')

            const total = (pagosData || []).reduce((s: number, p: Pago) => s + (p.montopagado || 0), 0)
            return {
              ...c,
              pagos: pagosData || [],
              totalPagado: total,
              isPaid: total >= (c.mensualidad || 0),
            }
          })
        )

        setCorridas(corridasConPagos)
      } catch (err) {
        console.error('Error loading corridas:', err)
      } finally {
        setLoadingCorridas(false)
      }
    }

    loadCorridas()
  }, [selectedVentaId])

  // ── Load initial corrida info (when initialCorridaId provided) ─
  useEffect(() => {
    if (!initialCorridaId) return

    const loadInitialCorrida = async () => {
      const { data } = await supabase
        .from('corridafinanciera')
        .select('*')
        .eq('corridafinancieraid', initialCorridaId)
        .single()

      if (data) {
        const { data: pagosData } = await supabase
          .from('pagos')
          .select('*')
          .eq('corridafinancieraid', initialCorridaId)
          .neq('estatus', 'C')

        const total = (pagosData || []).reduce((s: number, p: Pago) => s + (p.montopagado || 0), 0)
        // Cargos extra aplicables a esta corrida
        const cargosAplicables = data.nopago !== 0
          ? cargosExtra.filter(c => c.estatus !== 'X' && c.fecha != null && data.fecha != null && c.fecha <= data.fecha)
          : []
        const totalCargosExtra = cargosAplicables.reduce((s, c) => s + (c.monto || 0), 0)
        const totalAPagar = (data.mensualidad || 0) + totalCargosExtra
        const corridaInfo: CorridaWithPagos = {
          ...data,
          pagos: pagosData || [],
          totalPagado: total,
          isPaid: total >= totalAPagar,
        }
        setSelectedCorrida(corridaInfo)
        // Auto-fill monto with remaining balance (including cargos extra)
        if (!pago) {
          const remaining = totalAPagar - total
          if (remaining > 0) setMontopagado(String(remaining))
        }
      }
    }

    loadInitialCorrida()
  }, [initialCorridaId, pago])

  // ── Check for active convenio when corrida/venta changes ─────
  useEffect(() => {
    const ventaid = selectedCorrida?.ventaid
    if (!ventaid || isEditMode) {
      setActiveConvenio(null)
      return
    }
    setCheckingConvenio(true)
    supabase
      .from('convenios')
      .select('recargo_acordado, meses_atraso')
      .eq('ventaid', ventaid)
      .eq('estatus', 'V')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActiveConvenio(data ?? null)
        setCheckingConvenio(false)
      })
  }, [selectedCorrida?.ventaid, isEditMode])

  // ── Auto-calculate recargo when corrida, fechapago or convenio changes ──
  useEffect(() => {
    if (isEditMode || !selectedCorrida?.fecha || checkingConvenio) return
    if (activeConvenio) {
      const meses = activeConvenio.meses_atraso ?? 1
      const rAcordado = activeConvenio.recargo_acordado ?? 0
      setRecargo(meses > 0 ? Math.round((rAcordado / meses) * 100) / 100 : 0)
    } else {
      const calculated = calcularRecargo(selectedCorrida.fecha, fechapago, diasTolerancia)
      setRecargo(calculated)
    }
  }, [selectedCorrida, fechapago, isEditMode, activeConvenio, checkingConvenio])

  // ── Select corrida from table ──────────────────────────────────
  const handleSelectCorrida = (corrida: CorridaWithPagos) => {
    if (corrida.isPaid) return
    setSelectedCorrida(corrida)
    setCorridaId(corrida.corridafinancieraid)
    const remaining = (corrida.mensualidad || 0) - (corrida.totalPagado || 0)
    setMontopagado(String(remaining > 0 ? remaining : corrida.mensualidad || 0))
    setErrors((prev) => ({ ...prev, corridafinancieraid: '' }))
  }

  // ── Validation ─────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!corridaId) newErrors.corridafinancieraid = 'Selecciona una corrida financiera'
    if (!fechapago) newErrors.fechapago = 'La fecha es requerida'
    const monto = parseFloat(montopagado)
    if (!montopagado || isNaN(monto) || monto <= 0) newErrors.montopagado = 'Ingresa un monto válido mayor a 0'
    if (!formapago) newErrors.formapago = 'Selecciona la forma de pago'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    await onSubmit({
      corridafinancieraid: corridaId,
      fechapago,
      montopagado: parseFloat(montopagado),
      formapago,
      estatus,
      referencia: referencia.trim() || null,
      comentario: comentario.trim() || null,
      recargo,
      cobrador: formapago === 6 ? cobrador.trim() || null : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Section 1: Select Venta + Corrida (only when needed) ── */}
      {needsVentaPicker && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Venta / Corrida Financiera
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-1">
              Buscar Venta <span className="text-red-500">*</span>
            </label>
            {loadingVentas ? (
              <p className="text-sm text-[#9e9f92]">Cargando ventas...</p>
            ) : (
              <SearchCombobox
                options={ventaOptions}
                value={selectedVentaId}
                onChange={(v) => {
                  setSelectedVentaId(v)
                  setSelectedCorrida(null)
                  setCorridaId(null)
                  setMontopagado('')
                }}
                placeholder="Escribe el nombre del cliente o número de venta..."
              />
            )}
          </div>

          {/* Corrida table */}
          {selectedVentaId && (
            <div>
              <p className="text-sm font-medium text-black mb-2">
                Selecciona la Corrida Financiera <span className="text-red-500">*</span>
              </p>
              {errors.corridafinancieraid && (
                <p className="text-xs text-red-500 mb-2">{errors.corridafinancieraid}</p>
              )}
              {loadingCorridas ? (
                <p className="text-sm text-[#9e9f92]">Cargando corrida...</p>
              ) : corridas.length === 0 ? (
                <p className="text-sm text-gray-500">No hay corrida financiera para esta venta.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">No.</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Fecha</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Mensualidad</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Pagado</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Pendiente</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {corridas.map((c) => {
                        const isSelected = selectedCorrida?.corridafinancieraid === c.corridafinancieraid
                        const pendiente = (c.mensualidad || 0) - (c.totalPagado || 0)
                        return (
                          <tr
                            key={c.corridafinancieraid}
                            onClick={() => handleSelectCorrida(c)}
                            className={`transition-colors ${
                              c.isPaid
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                : isSelected
                                ? 'bg-[#eaae4c]/20 cursor-pointer'
                                : 'hover:bg-gray-50 cursor-pointer'
                            }`}
                          >
                            <td className="px-4 py-2 font-semibold">{c.nopago}</td>
                            <td className="px-4 py-2">{formatDate(c.fecha)}</td>
                            <td className="px-4 py-2">{formatCurrency(c.mensualidad)}</td>
                            <td className="px-4 py-2">{formatCurrency(c.totalPagado)}</td>
                            <td className="px-4 py-2">{c.isPaid ? '—' : formatCurrency(pendiente)}</td>
                            <td className="px-4 py-2">
                              {c.isPaid ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                  Pagado
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  Pendiente
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Corrida info when initialCorridaId is pre-set ──────── */}
      {!needsVentaPicker && selectedCorrida && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Corrida Financiera</p>
          <div className={`grid gap-4 text-sm ${totalCargosExtraCorrida > 0 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            <div>
              <p className="text-gray-500">No. de Pago</p>
              <p className="font-semibold text-gray-900">{selectedCorrida.nopago}</p>
            </div>
            <div>
              <p className="text-gray-500">Fecha Esperada</p>
              <p className="font-semibold text-gray-900">{formatDate(selectedCorrida.fecha)}</p>
            </div>
            <div>
              <p className="text-gray-500">Mensualidad</p>
              <p className="font-semibold text-gray-900">{formatCurrency(selectedCorrida.mensualidad)}</p>
            </div>
            {totalCargosExtraCorrida > 0 && (
              <div>
                <p className="text-gray-500">Cargos Extra</p>
                <div className="space-y-0.5">
                  {cargosExtra
                    .filter(c => c.estatus !== 'X' && c.fecha != null && selectedCorrida.fecha != null && c.fecha <= selectedCorrida.fecha)
                    .map(c => (
                      <p key={c.cargoid} className="font-semibold text-purple-700">
                        +{formatCurrency(c.monto)}
                        <span className="text-xs text-gray-400 ml-1 font-normal">({c.concepto})</span>
                      </p>
                    ))
                  }
                </div>
              </div>
            )}
            <div>
              <p className="text-gray-500">Pendiente</p>
              <p className="font-semibold text-orange-600">
                {formatCurrency((selectedCorrida.mensualidad || 0) + totalCargosExtraCorrida - (selectedCorrida.totalPagado || 0))}
              </p>
            </div>
          </div>
          {selectedCorrida.pagos && selectedCorrida.pagos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Pagos previos en esta corrida:</p>
              <div className="space-y-1">
                {selectedCorrida.pagos.map((p) => (
                  <div key={p.pagoid} className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{formatCurrency(p.montopagado)}</span>
                    <span>·</span>
                    <span>{formatDate(p.fechapago)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPagoStatusColor(p.estatus)}`}>
                      {getPagoStatusLabel(p.estatus)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Convenio vigente alert ───────────────────────────── */}
      {!isEditMode && selectedCorrida && activeConvenio && !checkingConvenio && (
        <div className="flex gap-3 bg-blue-50 border border-blue-300 rounded-lg p-4">
          <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">Convenio vigente aplicado</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Recargo según convenio:{' '}
              <span className="font-bold">
                {recargo > 0 ? `$${recargo.toLocaleString('es-MX')}` : 'Condonado ($0.00)'}
              </span>
              {(activeConvenio.meses_atraso ?? 0) > 1
                ? ` (${activeConvenio.meses_atraso} pagos en atraso acordados)`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Recargo alert (create mode, corrida overdue, sin convenio) ── */}
      {!isEditMode && selectedCorrida && !activeConvenio && !checkingConvenio && recargo > 0 && (
        <div className="flex gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Pago con atraso</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Recargo calculado: <span className="font-bold">${recargo.toLocaleString('es-MX')}.00</span> ($150 × cada 6 días de atraso)
            </p>
          </div>
        </div>
      )}

      {/* ── Corrida info in edit mode ──────────────────────────── */}
      {isEditMode && pago && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Venta / Corrida Financiera
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600">
              Corrida Financiera ID:{' '}
              <span className="font-semibold text-gray-900">{pago.corridafinancieraid}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Section 2: Datos del Pago ───────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Datos del Pago
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Monto Pagado <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={montopagado}
              onChange={(e) => setMontopagado(e.target.value)}
              placeholder="0.00"
              className={errors.montopagado ? 'border-red-500' : ''}
            />
            {errors.montopagado && <p className="text-xs text-red-500 mt-1">{errors.montopagado}</p>}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Fecha de Pago <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={fechapago}
              onChange={(e) => setFechapago(e.target.value)}
              className={errors.fechapago ? 'border-red-500' : ''}
            />
            {errors.fechapago && <p className="text-xs text-red-500 mt-1">{errors.fechapago}</p>}
          </div>

          {/* Forma de Pago */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Forma de Pago <span className="text-red-500">*</span>
            </label>
            <select
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] ${
                errors.formapago ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formapago}
              onChange={(e) => setFormapago(Number(e.target.value))}
            >
              {FORMAS_PAGO.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {errors.formapago && <p className="text-xs text-red-500 mt-1">{errors.formapago}</p>}
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Referencia / Folio</label>
            <Input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Número de folio, transferencia, cheque..."
            />
          </div>

          {/* Cobrador — solo cuando Ruta de cobranza */}
          {formapago === 6 && (
            <div>
              <label className="block text-sm font-medium text-black mb-1">Cobrador</label>
              <Input
                type="text"
                value={cobrador}
                onChange={(e) => setCobrador(e.target.value)}
                placeholder="Nombre del cobrador que recibió el pago..."
              />
            </div>
          )}

          {/* Recargo */}
          {!isEditMode && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-black mb-1">
                Recargo por atraso{' '}
                <span className="text-gray-400 font-normal">(se calcula automáticamente, editable)</span>
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={recargo}
                onChange={(e) => setRecargo(Math.max(0, parseFloat(e.target.value) || 0))}
                className="max-w-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Notas y Estado ──────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Notas
        </h3>

        <div className="space-y-4">
          {/* Estatus (edit mode only) */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-black mb-1">Estado</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={estatus}
                onChange={(e) => setEstatus(e.target.value)}
              >
                <option value="P">Pagado</option>
                <option value="C">Cancelado</option>
              </select>
            </div>
          )}

          {/* Comentario */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Comentario</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none"
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Observaciones opcionales sobre el pago..."
            />
          </div>
        </div>
      </div>

      {/* ── Submit ────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="submit"
          disabled={isLoading}
          className="px-6"
          style={{ backgroundColor: '#eaae4c', color: '#000' }}
        >
          {isLoading
            ? 'Guardando...'
            : isEditMode
            ? 'Guardar Cambios'
            : 'Registrar Pago'}
        </Button>
      </div>
    </form>
  )
}
