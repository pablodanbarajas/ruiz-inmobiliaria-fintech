import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import type { Lote, Cliente, Venta, Desarrollo } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

// ── VentaForm ────────────────────────────────────────────────────────────────
export interface VentaFormData {
  loteid: number
  clienteid: number
  fecha: string
  fechacontrato: string
  preciolote: number
  enganche: number
  porcenganche: number
  fechaenganche: string
  plazo: number
  fechaprimeramensualidad: string
  mensualidad: number
  estatus: string
  comentarios: string | null
  plazoenganche: number
  dias_tolerancia: number | null
  vendedor: string | null
}

interface VentaFormProps {
  venta?: Venta | null
  onSubmit: (data: VentaFormData) => Promise<void>
  isLoading?: boolean
  defaultLoteId?: number
}

type LoteWithDesarrollo = Lote & { desarrollo?: Desarrollo }

export const VentaForm = ({ venta, onSubmit, isLoading = false, defaultLoteId }: VentaFormProps) => {
  const isEditMode = !!venta
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    loteid: venta?.loteid?.toString() ?? (defaultLoteId?.toString() ?? ''),
    clienteid: venta?.clienteid?.toString() ?? '',
    fecha: venta?.fecha ? venta.fecha.split('T')[0] : today,
    fechacontrato: venta?.fechacontrato ? venta.fechacontrato.split('T')[0] : today,
    preciolote: venta?.preciolote?.toString() ?? '',
    enganche: venta?.enganche?.toString() ?? '',
    fechaenganche: venta?.fechaenganche ? venta.fechaenganche.split('T')[0] : today,
    plazo: venta?.plazo?.toString() ?? '',
    fechaprimeramensualidad: venta?.fechaprimeramensualidad
      ? venta.fechaprimeramensualidad.split('T')[0]
      : '',
    estatus: venta?.estatus ?? 'A',
    comentarios: venta?.comentarios ?? '',
    plazoenganche: venta?.plazoenganche?.toString() ?? '1',
    dias_tolerancia: venta?.dias_tolerancia?.toString() ?? '0',
    vendedor: venta?.vendedor ?? '',
  })

  const [lotes, setLotes] = useState<LoteWithDesarrollo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [enganchemin, setEnganchemin] = useState<number>(0)

  // Combobox option arrays (memoised from loaded data)
  const loteOptions: ComboOption[] = lotes.map((l) => ({
    value: l.loteid.toString(),
    label: `${l.desarrollo?.nombre ?? '?'} · Mza ${l.manzana} Lote ${l.nolote}`,
    sublabel: [
      l.superficie ? `${l.superficie} m²` : '',
      l.preciolote ? formatCurrency(l.preciolote) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }))

  const clienteOptions: ComboOption[] = clientes.map((c) => ({
    value: c.clienteid.toString(),
    label: c.nombre ?? `Cliente #${c.clienteid}`,
    sublabel: [c.email, c.rfc].filter(Boolean).join(' · '),
  }))
  // Derived financial values (real-time calculations)
  const precioNum = parseFloat(formData.preciolote) || 0
  const engancheNum = parseFloat(formData.enganche) || 0
  const plazoNum = parseInt(formData.plazo) || 0
  const porcEnganche = precioNum > 0 ? (engancheNum / precioNum) * 100 : 0
  const saldoFinanciar = precioNum - engancheNum
  const mensualidadCalc = plazoNum > 0 && saldoFinanciar > 0 ? saldoFinanciar / plazoNum : 0

  useEffect(() => {
    const fetchCatalogos = async () => {
      const [{ data: lotesData }] = await Promise.all([
        supabase
          .from('lote')
          .select('loteid, desarrolloid, manzana, nolote, clavelote, superficie, preciolote, estatus, desarrollo:desarrollo(*)')
          .eq('estatus', 'D')
          .order('desarrolloid')
          .then((res) => ({
            ...res,
            data: DEMO_DESARROLLOIDS.length > 0
              ? (res.data || []).filter((l: any) => DEMO_DESARROLLOIDS.includes(l.desarrolloid))
              : res.data,
          })),
        // clientes: placeholder, fetched with pagination below
        Promise.resolve({ data: null }),
      ])

      // Fetch ALL clientes in pages of 1000 (Supabase default limit)
      let allClientes: Cliente[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      while (hasMore) {
        const { data: pageData } = await supabase
          .from('cliente')
          .select('clienteid, nombre, email, rfc, estatus')
          .order('nombre')
          .range(page * pageSize, (page + 1) * pageSize - 1)
        if (!pageData || pageData.length === 0) {
          hasMore = false
        } else {
          allClientes = [...allClientes, ...(pageData as Cliente[])]
          page++
          if (pageData.length < pageSize) hasMore = false
        }
      }

      let lotesResult = (lotesData || []) as unknown as LoteWithDesarrollo[]

      // In edit mode, include the current lote even if it's no longer 'D'
      if (venta?.loteid) {
        const already = lotesResult.some((l) => l.loteid === venta.loteid)
        if (!already) {
          const { data: currentLote } = await supabase
            .from('lote')
            .select('loteid, desarrolloid, manzana, nolote, clavelote, superficie, preciolote, estatus, desarrollo:desarrollo(*)')
            .eq('loteid', venta.loteid)
            .single()
          if (currentLote) {
            lotesResult = [currentLote as unknown as LoteWithDesarrollo, ...lotesResult]
          }
        }
      }

      setLotes(lotesResult)
      setClientes(allClientes)
    }
    fetchCatalogos()
  }, [venta?.loteid])

  // When defaultLoteId is provided and lotes have loaded, auto-fill prices
  useEffect(() => {
    if (!defaultLoteId || isEditMode || lotes.length === 0) return
    handleLoteChange(defaultLoteId.toString())
  }, [lotes, defaultLoteId])

  // Auto-fill preciolote and enganche when a lote is selected (create mode only)
  const handleLoteChange = async (loteid: string) => {
    if (isEditMode) return
    const selected = lotes.find((l) => l.loteid.toString() === loteid)

    // Pre-fill price immediately from lote data
    setFormData((prev) => ({
      ...prev,
      loteid,
      preciolote: selected?.preciolote?.toString() ?? prev.preciolote,
    }))

    // Fetch desarrollo directly to reliably get enganche
    const desarrolloid = selected?.desarrolloid
    if (desarrolloid) {
      const { data: dev } = await supabase
        .from('desarrollo')
        .select('enganche')
        .eq('desarrolloid', desarrolloid)
        .single()
      const rawEnganche = dev?.enganche ?? ''
      const min = rawEnganche ? parseFloat(rawEnganche.replace(/[$,\s]/g, '')) || 0 : 0
      setEnganchemin(min)
      if (min > 0) {
        setFormData((prev) => ({ ...prev, enganche: min.toString() }))
      }
    } else {
      setEnganchemin(0)
    }
  }

  // reset enganchemin when loteid is cleared
  useEffect(() => {
    if (!formData.loteid) setEnganchemin(0)
  }, [formData.loteid])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.loteid) errs.loteid = 'Lote requerido'
    if (!formData.clienteid) errs.clienteid = 'Cliente requerido'
    if (!formData.fecha) errs.fecha = 'Fecha de venta requerida'
    if (!formData.fechacontrato) errs.fechacontrato = 'Fecha de contrato requerida'
    if (!isEditMode) {
      if (!formData.preciolote || precioNum <= 0)
        errs.preciolote = 'Precio del lote requerido y debe ser mayor a 0'
      if (!formData.enganche || engancheNum <= 0)
        errs.enganche = 'Enganche requerido y debe ser mayor a 0'
      else if (enganchemin > 0 && engancheNum < enganchemin)
        errs.enganche = `El enganche mínimo del desarrollo es ${formatCurrency(enganchemin)}`
      else if (engancheNum >= precioNum)
        errs.enganche = 'El enganche no puede ser igual o mayor al precio total'
      if (!formData.plazo || plazoNum <= 0) errs.plazo = 'Plazo requerido y debe ser mayor a 0'
    }
    if (!formData.fechaenganche) errs.fechaenganche = 'Fecha de enganche requerida'
    if (!formData.fechaprimeramensualidad)
      errs.fechaprimeramensualidad = 'Fecha de primera mensualidad requerida'
    if (
      formData.fechaprimeramensualidad &&
      formData.fechacontrato &&
      formData.fechaprimeramensualidad <= formData.fechacontrato
    ) {
      errs.fechaprimeramensualidad =
        'La fecha de primera mensualidad debe ser posterior al contrato'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const data: VentaFormData = {
      loteid: parseInt(formData.loteid),
      clienteid: parseInt(formData.clienteid),
      fecha: formData.fecha,
      fechacontrato: formData.fechacontrato,
      preciolote: precioNum,
      enganche: engancheNum,
      porcenganche: parseFloat(porcEnganche.toFixed(2)),
      fechaenganche: formData.fechaenganche,
      plazo: plazoNum,
      fechaprimeramensualidad: formData.fechaprimeramensualidad,
      mensualidad: parseFloat(mensualidadCalc.toFixed(2)),
      estatus: formData.estatus,
      comentarios: formData.comentarios || null,
      plazoenganche: parseInt(formData.plazoenganche) || 1,
      dias_tolerancia: parseInt(formData.dias_tolerancia) > 0 ? parseInt(formData.dias_tolerancia) : null,
      vendedor: formData.vendedor?.trim() || null,
    }
    await onSubmit(data)
  }

  const sectionHeading =
    'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Lote y Cliente ─────────────────────────────────── */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <p className={sectionHeading}>Lote y Cliente</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lote */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lote *{' '}
              {!isEditMode && (
                <span className="font-normal text-gray-400">(solo disponibles)</span>
              )}
            </label>
            <SearchCombobox
              options={loteOptions}
              value={formData.loteid}
              onChange={(val) => handleLoteChange(val)}
              placeholder="Buscar por desarrollo, manzana, lote…"
              disabled={isLoading || isEditMode}
              error={errors.loteid}
            />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <SearchCombobox
              options={clienteOptions}
              value={formData.clienteid}
              onChange={(val) => setFormData({ ...formData, clienteid: val })}
              placeholder="Buscar por nombre, email o RFC…"
              disabled={isLoading || isEditMode}
              error={errors.clienteid}
            />
          </div>
        </div>
      </div>

      {/* ── Fechas ─────────────────────────────────────────── */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <p className={sectionHeading}>Fechas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Venta *
            </label>
            <Input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              disabled={isLoading}
            />
            {errors.fecha && <p className="text-red-500 text-xs mt-1">{errors.fecha}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Contrato *
            </label>
            <Input
              type="date"
              value={formData.fechacontrato}
              onChange={(e) => setFormData({ ...formData, fechacontrato: e.target.value })}
              disabled={isLoading}
            />
            {errors.fechacontrato && (
              <p className="text-red-500 text-xs mt-1">{errors.fechacontrato}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Enganche *
            </label>
            <Input
              type="date"
              value={formData.fechaenganche}
              onChange={(e) => setFormData({ ...formData, fechaenganche: e.target.value })}
              disabled={isLoading}
            />
            {errors.fechaenganche && (
              <p className="text-red-500 text-xs mt-1">{errors.fechaenganche}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Primera Mensualidad *
            </label>
            <Input
              type="date"
              value={formData.fechaprimeramensualidad}
              onChange={(e) =>
                setFormData({ ...formData, fechaprimeramensualidad: e.target.value })
              }
              disabled={isLoading}
            />
            {errors.fechaprimeramensualidad && (
              <p className="text-red-500 text-xs mt-1">{errors.fechaprimeramensualidad}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Datos Financieros ──────────────────────────────── */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <p className={sectionHeading}>
          Datos Financieros
          {isEditMode && (
            <span className="ml-2 font-normal normal-case text-gray-400">
              (solo lectura — cancela y recrea la venta para modificar términos)
            </span>
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio del Lote *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.preciolote}
              onChange={(e) => setFormData({ ...formData, preciolote: e.target.value })}
              disabled={isLoading || isEditMode}
            />
            {errors.preciolote && (
              <p className="text-red-500 text-xs mt-1">{errors.preciolote}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enganche *</label>
            <Input
              type="number"
              step="0.01"
              min={enganchemin > 0 ? enganchemin : 0}
              placeholder="0.00"
              value={formData.enganche}
              onChange={(e) => setFormData({ ...formData, enganche: e.target.value })}
              disabled={isLoading || isEditMode}
            />
            {errors.enganche && (
              <p className="text-red-500 text-xs mt-1">{errors.enganche}</p>
            )}
            {!isEditMode && enganchemin > 0 && !errors.enganche && (
              <p className="text-xs text-gray-500 mt-1">Mínimo: {formatCurrency(enganchemin)}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plazo (meses) *
            </label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="120"
              value={formData.plazo}
              onChange={(e) => setFormData({ ...formData, plazo: e.target.value })}
              disabled={isLoading || isEditMode}
            />
            {errors.plazo && <p className="text-red-500 text-xs mt-1">{errors.plazo}</p>}
          </div>
        </div>

        {/* Real-time financial summary (create mode) */}
        {!isEditMode && precioNum > 0 && (
          <div className="grid grid-cols-3 gap-4 bg-white border border-[#eaae4c] rounded-lg p-4 mt-2">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">% Enganche</p>
              <p className="text-lg font-bold text-[#504840]">{porcEnganche.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Saldo a Financiar
              </p>
              <p className="text-lg font-bold text-[#504840]">{formatCurrency(saldoFinanciar)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Mensualidad
              </p>
              <p className="text-lg font-bold text-[#eaae4c]">
                {mensualidadCalc > 0 ? formatCurrency(mensualidadCalc) : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Read-only summary in edit mode */}
        {isEditMode && precioNum > 0 && (
          <div className="grid grid-cols-3 gap-4 bg-white border border-gray-200 rounded-lg p-4 mt-2">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Precio Lote</p>
              <p className="text-lg font-bold text-gray-700">{formatCurrency(precioNum)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Enganche</p>
              <p className="text-lg font-bold text-gray-700">{formatCurrency(engancheNum)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Mensualidad</p>
              <p className="text-lg font-bold text-gray-700">
                {venta?.mensualidad ? formatCurrency(venta.mensualidad) : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Vendedor ────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
        <Input
          type="text"
          value={formData.vendedor ?? ''}
          onChange={(e) => setFormData({ ...formData, vendedor: e.target.value })}
          disabled={isLoading}
          placeholder="Nombre del vendedor (opcional)"
        />
      </div>

      {/* ── Estatus y Comentarios ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isEditMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estatus</label>
            <select
              value={formData.estatus}
              onChange={(e) => setFormData({ ...formData, estatus: e.target.value })}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] disabled:bg-gray-100"
            >
              <option value="A">Activa</option>
              <option value="C">Cancelada</option>
            </select>
          </div>
        )}
        <div className={isEditMode ? '' : 'md:col-span-2'}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
          <textarea
            value={formData.comentarios ?? ''}
            onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
            disabled={isLoading}
            rows={3}
            placeholder="Observaciones adicionales…"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* ── Tolerancia de pago ─────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className={sectionHeading}>Tolerancia de pago</p>
        <div className="flex items-start gap-4">
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Días de tolerancia
            </label>
            <Input
              type="number"
              step="1"
              min="0"
              max="60"
              placeholder="0"
              value={formData.dias_tolerancia}
              onChange={(e) => setFormData({ ...formData, dias_tolerancia: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="pt-7 text-sm text-amber-800">
            {parseInt(formData.dias_tolerancia) > 0 ? (
              <p>
                El recargo <strong>no</strong> se aplicará hasta{' '}
                <strong>{formData.dias_tolerancia} días</strong> después del vencimiento.
                El admin debe activar esto manualmente por venta.
              </p>
            ) : (
              <p className="text-gray-500">
                Sin tolerancia — el recargo aplica desde el primer día de atraso.
                Asigna días para que el cliente tenga un margen antes de que se cargue el recargo.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Acciones ───────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? 'Guardando…'
            : isEditMode
            ? 'Guardar Cambios'
            : 'Registrar Venta'}
        </Button>
      </div>
    </form>
  )
}
