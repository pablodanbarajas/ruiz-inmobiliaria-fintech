import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Convenio } from '@/types/database'
import { MOTIVOS_CONVENIO, calcularRecargo, formatCurrency } from '@/utils/helpers'

export interface ConvenioFormData {
  ventaid: number
  clienteid: number | null
  fecha: string
  motivo: string
  descripcion: string
  meses_atraso: number
  meses_convenio: number
  recargo_original: number
  recargo_acordado: number
  deuda_mensualidades: number
  deuda_total_convenio: number
  monto_convenio_mensual: number
  mensualidad_corriente: number
  pago_total_mensual_objetivo: number
  fecha_fin_estimada: string | null
  estatus: string
  comentarios: string | null
}

interface ConvenioFormProps {
  /** Pre-selected ventaid (from VentaDetail) */
  initialVentaId?: number
  convenio?: Convenio
  conveniosEsteAnio?: number  // count of convenios this year for this venta
  /** Days of tolerance before recargo applies (set per venta by admin) */
  diasTolerancia?: number
  onSubmit: (data: ConvenioFormData) => Promise<void>
  isLoading?: boolean
}

const today = () => new Date().toISOString().split('T')[0]
const LIMITE_ANUAL = 3

interface VentaOption {
  ventaid: number
  label: string
  clienteid: number | null
  mensualidad: number | null
}

export const ConvenioForm = ({
  initialVentaId,
  convenio,
  conveniosEsteAnio = 0,
  diasTolerancia = 0,
  onSubmit,
  isLoading,
}: ConvenioFormProps) => {
  const isEditMode = !!convenio
  const needsVentaPicker = !isEditMode && !initialVentaId

  const [ventaOptions, setVentaOptions] = useState<VentaOption[]>([])
  const [selectedVentaId, setSelectedVentaId] = useState<number | null>(
    initialVentaId ?? (convenio ? convenio.ventaid : null)
  )
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(
    convenio?.clienteid ?? null
  )
  const [ventaLoading, setVentaLoading] = useState(false)

  // Atrasos en corridas for selected venta
  const [corridasEnAtraso, setCorridasEnAtraso] = useState<number>(0)
  const [loadingAtrasos, setLoadingAtrasos] = useState(false)
  const [ventaMensualidad, setVentaMensualidad] = useState<number>(0)
  const [deudaMensualidades, setDeudaMensualidades] = useState<number>(convenio?.deuda_mensualidades ?? 0)
  const [deudaTotalConvenio, setDeudaTotalConvenio] = useState<number>(convenio?.deuda_total_convenio ?? 0)
  const [mesesConvenio, setMesesConvenio] = useState<number>(Math.max(1, convenio?.meses_convenio ?? convenio?.meses_atraso ?? 1))
  const [montoConvenioMensual, setMontoConvenioMensual] = useState<number>(convenio?.monto_convenio_mensual ?? 0)
  const [pagoTotalMensualObjetivo, setPagoTotalMensualObjetivo] = useState<number>(convenio?.pago_total_mensual_objetivo ?? 0)
  const [fechaFinEstimada, setFechaFinEstimada] = useState<string | null>(convenio?.fecha_fin_estimada ?? null)

  // Form fields
  const [fecha, setFecha] = useState(convenio?.fecha ?? today())
  const [motivo, setMotivo] = useState(convenio?.motivo ?? MOTIVOS_CONVENIO[0])
  const [descripcion, setDescripcion] = useState(convenio?.descripcion ?? '')
  const [mesesAtraso, setMesesAtraso] = useState<number>(convenio?.meses_atraso ?? 0)
  const [recargoOriginal, setRecargoOriginal] = useState<number>(convenio?.recargo_original ?? 0)
  const [recargoAcordado, setRecargoAcordado] = useState<number>(convenio?.recargo_acordado ?? 0)
  const [estatus, setEstatus] = useState(convenio?.estatus ?? 'V')
  const [comentarios, setComentarios] = useState(convenio?.comentarios ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load ventas for picker
  useEffect(() => {
    if (!needsVentaPicker) return
    setVentaLoading(true)
    supabase
      .from('venta')
      .select('ventaid, clienteid, estatus, mensualidad, cliente:cliente(nombre), lote:lote(manzana, nolote)')
      .neq('estatus', 'C')
      .order('ventaid', { ascending: false })
      .then(({ data }) => {
        setVentaOptions(
          (data || []).map((v: any) => ({
            ventaid: v.ventaid,
            clienteid: v.clienteid,
            mensualidad: v.mensualidad,
            label: `#${v.ventaid} — ${v.cliente?.nombre ?? 'Sin cliente'} | Mza ${v.lote?.manzana ?? '-'} Lote ${v.lote?.nolote ?? '-'}`,
          }))
        )
        setVentaLoading(false)
      })
  }, [needsVentaPicker])

  useEffect(() => {
    if (!selectedVentaId) return
    supabase
      .from('venta')
      .select('mensualidad')
      .eq('ventaid', selectedVentaId)
      .single()
      .then(({ data }) => {
        setVentaMensualidad(Number((data as any)?.mensualidad || 0))
      })
  }, [selectedVentaId])

  // Detect overdue corridas for selected venta
  useEffect(() => {
    if (!selectedVentaId) {
      setCorridasEnAtraso(0)
      return
    }
    setLoadingAtrasos(true)
    const todayStr = today()
    supabase
      .from('corridafinanciera')
      .select('corridafinancieraid, fecha, mensualidad')
      .eq('ventaid', selectedVentaId)
      .lt('fecha', todayStr)
      .gt('nopago', 0)
      .then(async ({ data: corridas }) => {
        if (!corridas?.length) {
          setCorridasEnAtraso(0)
          setMesesAtraso(0)
          setDeudaMensualidades(0)
          setDeudaTotalConvenio(0)
          setMontoConvenioMensual(0)
          setPagoTotalMensualObjetivo(ventaMensualidad)
          setLoadingAtrasos(false)
          return
        }
        // Sum overdue debt based on remaining amount per overdue corrida.
        let count = 0
        let totalRecargo = 0
        let totalDeudaMensualidades = 0
        for (const c of corridas) {
          const { data: pagos } = await supabase
            .from('pagos')
            .select('montopagado')
            .eq('corridafinancieraid', c.corridafinancieraid)
            .neq('estatus', 'C')

          const totalPagado = (pagos || []).reduce((acc: number, p: any) => acc + Number(p.montopagado || 0), 0)
          const pendiente = Math.max(0, Number(c.mensualidad || 0) - totalPagado)

          if (pendiente > 0) {
            count++
            totalDeudaMensualidades += pendiente
            totalRecargo += calcularRecargo(c.fecha ?? '', undefined, diasTolerancia)
          }
        }
        setCorridasEnAtraso(count)
        if (!isEditMode) {
          setMesesAtraso(count)
          setDeudaMensualidades(totalDeudaMensualidades)
          setRecargoOriginal(totalRecargo)
          setRecargoAcordado(totalRecargo)
        }
        setLoadingAtrasos(false)
      })
  }, [selectedVentaId, isEditMode, diasTolerancia, ventaMensualidad])

  useEffect(() => {
    const meses = Math.max(1, mesesConvenio || 1)
    const deudaTotal = Math.max(0, deudaMensualidades + recargoAcordado)
    const pagoConvenio = deudaTotal > 0 ? Math.round((deudaTotal / meses) * 100) / 100 : 0
    const pagoTotal = Math.round((ventaMensualidad + pagoConvenio) * 100) / 100

    setDeudaTotalConvenio(deudaTotal)
    setMontoConvenioMensual(pagoConvenio)
    setPagoTotalMensualObjetivo(pagoTotal)

    if (fecha) {
      const base = new Date(fecha + 'T12:00:00')
      base.setMonth(base.getMonth() + meses - 1)
      setFechaFinEstimada(base.toISOString().split('T')[0])
    } else {
      setFechaFinEstimada(null)
    }
  }, [deudaMensualidades, recargoAcordado, mesesConvenio, ventaMensualidad, fecha])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!selectedVentaId) e.ventaid = 'Selecciona una venta'
    if (!fecha) e.fecha = 'La fecha es requerida'
    if (!motivo) e.motivo = 'El motivo es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    await onSubmit({
      ventaid: selectedVentaId!,
      clienteid: selectedClienteId,
      fecha,
      motivo,
      descripcion: descripcion.trim(),
      meses_atraso: mesesAtraso,
      meses_convenio: Math.max(1, mesesConvenio),
      recargo_original: recargoOriginal,
      recargo_acordado: recargoAcordado,
      deuda_mensualidades: deudaMensualidades,
      deuda_total_convenio: deudaTotalConvenio,
      monto_convenio_mensual: montoConvenioMensual,
      mensualidad_corriente: ventaMensualidad,
      pago_total_mensual_objetivo: pagoTotalMensualObjetivo,
      fecha_fin_estimada: fechaFinEstimada,
      estatus,
      comentarios: comentarios.trim() || null,
    })
  }

  const atLimitCreate = !isEditMode && conveniosEsteAnio >= LIMITE_ANUAL

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Limit warning */}
      {atLimitCreate && (
        <div className="flex gap-3 bg-red-50 border border-red-300 rounded-lg p-4">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-800">
            Esta venta ya tiene {LIMITE_ANUAL} convenios en el año {new Date().getFullYear()}. No se pueden crear más.
          </p>
        </div>
      )}

      {/* Near-limit warning */}
      {!isEditMode && conveniosEsteAnio === LIMITE_ANUAL - 1 && (
        <div className="flex gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">¡Último convenio disponible!</span> Esta venta ya tiene {conveniosEsteAnio}/{LIMITE_ANUAL} convenios este año.
          </p>
        </div>
      )}

      {/* Atraso info */}
      {selectedVentaId && !isEditMode && (
        <div className={`rounded-lg p-4 border ${corridasEnAtraso > 0 ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
          {loadingAtrasos ? (
            <p className="text-sm text-gray-500">Calculando atrasos...</p>
          ) : corridasEnAtraso > 0 ? (
            <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <AlertTriangle size={15} className="flex-shrink-0" />
              Esta venta tiene <span className="text-orange-700">{corridasEnAtraso} pago{corridasEnAtraso > 1 ? 's' : ''} vencido{corridasEnAtraso > 1 ? 's' : ''}</span> sin registrar.
            </p>
          ) : (
            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              Esta venta no tiene pagos vencidos.
            </p>
          )}
        </div>
      )}

      {/* ── Venta picker ───────────────────────────── */}
      {needsVentaPicker && (
        <div>
          <label className="block text-sm font-medium text-black mb-1">
            Venta <span className="text-red-500">*</span>
          </label>
          {ventaLoading ? (
            <p className="text-sm text-gray-400">Cargando ventas...</p>
          ) : (
            <select
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] ${errors.ventaid ? 'border-red-500' : 'border-gray-300'}`}
              value={selectedVentaId ?? ''}
              onChange={(e) => {
                const v = ventaOptions.find((o) => o.ventaid === Number(e.target.value))
                setSelectedVentaId(v?.ventaid ?? null)
                setSelectedClienteId(v?.clienteid ?? null)
                setVentaMensualidad(Number(v?.mensualidad || 0))
              }}
            >
              <option value="">Selecciona una venta...</option>
              {ventaOptions.map((o) => (
                <option key={o.ventaid} value={o.ventaid}>{o.label}</option>
              ))}
            </select>
          )}
          {errors.ventaid && <p className="text-xs text-red-500 mt-1">{errors.ventaid}</p>}
        </div>
      )}

      {/* ── Datos del convenio ─────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
          Datos del Convenio
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={errors.fecha ? 'border-red-500' : ''}
            />
            {errors.fecha && <p className="text-xs text-red-500 mt-1">{errors.fecha}</p>}
          </div>

          {/* Meses de atraso */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Meses / Pagos en atraso{' '}
              <span className="text-gray-400 font-normal">(auto-calculado)</span>
            </label>
            <Input
              type="number"
              min="0"
              value={mesesAtraso}
              onChange={(e) => setMesesAtraso(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>

          {/* Meses del convenio */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Meses para liquidar atraso <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="1"
              value={mesesConvenio}
              onChange={(e) => setMesesConvenio(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          {/* Motivo */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-black mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <select
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] ${errors.motivo ? 'border-red-500' : 'border-gray-300'}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS_CONVENIO.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {errors.motivo && <p className="text-xs text-red-500 mt-1">{errors.motivo}</p>}
          </div>

          {/* Recargos negociados */}
          {(corridasEnAtraso > 0 || isEditMode) && (
            <div className="md:col-span-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-800 mb-3">Plan de convenio (atraso + mensualidad corriente)</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Deuda mensualidades vencidas</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(deudaMensualidades)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Recargo calculado (total)</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(recargoOriginal)}</p>
                    <p className="text-xs text-gray-400">$150 × c/6 días por corrida</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">
                      Recargo acordado{' '}
                      <span className="text-gray-400 font-normal">(negociado)</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={recargoAcordado}
                      onChange={(e) => setRecargoAcordado(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = condonación total</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Deuda total negociada</p>
                    <p className="text-lg font-bold text-amber-900">{formatCurrency(deudaTotalConvenio)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cuota mensual convenio</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(montoConvenioMensual)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Mensualidad corriente</p>
                    <p className="text-lg font-bold text-gray-700">{formatCurrency(ventaMensualidad)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pago mensual objetivo</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(pagoTotalMensualObjetivo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fin estimado del convenio</p>
                    <p className="text-sm font-semibold text-gray-800">{fechaFinEstimada || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Descuento / Condonado</p>
                    <p className={`text-lg font-bold ${recargoOriginal - recargoAcordado > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatCurrency(Math.max(0, recargoOriginal - recargoAcordado))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Descripción / Términos */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-black mb-1">
              Descripción / Términos acordados <span className="text-red-500">*</span>
            </label>
            <textarea
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none ${errors.descripcion ? 'border-red-500' : 'border-gray-300'}`}
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe los términos del convenio: plazos acordados, montos, condiciones..."
            />
            {errors.descripcion && <p className="text-xs text-red-500 mt-1">{errors.descripcion}</p>}
          </div>
        </div>
      </div>

      {/* ── Estado y notas ─────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Notas</h3>
        <div className="space-y-4">
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-black mb-1">Estado</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={estatus}
                onChange={(e) => setEstatus(e.target.value)}
              >
                <option value="V">Vigente</option>
                <option value="C">Cumplido</option>
                <option value="X">Cancelado</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Comentarios adicionales</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none"
              rows={2}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Observaciones opcionales..."
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="submit"
          disabled={isLoading || atLimitCreate}
          className="px-6"
          style={{ backgroundColor: '#eaae4c', color: '#000' }}
        >
          {isLoading ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Registrar Convenio'}
        </Button>
      </div>
    </form>
  )
}
