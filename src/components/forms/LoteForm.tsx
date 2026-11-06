import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Lote, Desarrollo, Duenio } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

interface LoteFormProps {
  lote?: Lote | null
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const LoteForm = ({ lote, onSubmit, isLoading = false }: LoteFormProps) => {
  const [formData, setFormData] = useState({
    desarrolloid: '',
    zona: '',
    duenioid: '',
    clavelote: '',
    coto: '',
    manzana: '',
    nolote: '',
    tipolote: 'Habitacional',
    linderonte: '',
    colindanciante: '',
    linderosur: '',
    colindanciasur: '',
    linderoote: '',
    colindanciaote: '',
    linderopte: '',
    colindanciapte: '',
    superficie: '',
    preciopormt2: '',
    preciolote: '',
    estatus: 'D',
    comentarios: '',
  })
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [tipoPanteonesIds, setTipoPanteonesIds] = useState<number[]>([])
  const [duenios, setDuenios] = useState<Duenio[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [autoClaveKey, setAutoClaveKey] = useState(!lote)
  const formRef = useRef<HTMLFormElement>(null)

  const normalizeClavePart = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()

  const buildClave = (
    desarrolloid: string,
    coto: string,
    manzana: string,
    nolote: string,
    zona = formData.zona,
    tipolote = formData.tipolote,
  ) => {
    const des = desarrollos.find(d => d.desarrolloid?.toString() === desarrolloid)
    if (!des?.clavedesarrollo) return ''
    if (tipoPanteonesIds.includes(des.tipodesarrolloid || 0)) {
      const parts = [
        normalizeClavePart(des.clavedesarrollo).slice(0, 3),
        normalizeClavePart(zona).slice(0, 3),
        normalizeClavePart(tipolote).slice(0, 3),
      ]
      return parts.filter(Boolean).join('-')
    }
    const parts = [des.clavedesarrollo]
    if (coto) parts.push(coto.padStart(2, '0'))
    if (manzana) parts.push(manzana.padStart(2, '0'))
    if (nolote) parts.push(nolote.padStart(3, '0'))
    return parts.join('-')
  }

  useEffect(() => {
    if (lote) {
      setFormData({
        desarrolloid: lote.desarrolloid?.toString() || '',
        zona: lote.zona || '',
        duenioid: lote.duenioid?.toString() || '',
        clavelote: lote.clavelote || '',
        coto: lote.coto || '',
        manzana: lote.manzana || '',
        nolote: lote.nolote || '',
        tipolote: lote.tipolote || 'Habitacional',
        linderonte: lote.linderonte?.toString() || '',
        colindanciante: lote.colindanciante || '',
        linderosur: lote.linderosur?.toString() || '',
        colindanciasur: lote.colindanciasur || '',
        linderoote: lote.linderoote?.toString() || '',
        colindanciaote: lote.colindanciaote || '',
        linderopte: lote.linderopte?.toString() || '',
        colindanciapte: lote.colindanciapte || '',
        superficie: lote.superficie?.toString() || '',
        preciopormt2: lote.preciopormt2?.toString() || '',
        preciolote: lote.preciolote?.toString() || '',
        estatus: lote.estatus || 'D',
        comentarios: lote.comentarios || '',
      })
    }
  }, [lote])

  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const [
          { data: desData, error: desError },
          { data: tipoData, error: tipoError },
          { data: duenData, error: duenError },
        ] = await Promise.all([
          supabase.from('desarrollo').select('desarrolloid, nombre, clavedesarrollo, estatus, tipodesarrolloid').order('nombre'),
          supabase.from('tipodesarrollo').select('tipodesarrolloid').ilike('descripcion', '%panteon%'),
          supabase.from('duenio').select('duenioid, nombre').order('nombre'),
        ])

        if (desError) throw desError
        if (tipoError) throw tipoError
        if (duenError) throw duenError

        const allDesarrollos = (desData || []) as Desarrollo[]
        setTipoPanteonesIds((tipoData || []).map((tipo) => tipo.tipodesarrolloid))
        setDesarrollos(
          DEMO_DESARROLLOIDS.length > 0
            ? allDesarrollos.filter((d) => DEMO_DESARROLLOIDS.includes(d.desarrolloid))
            : allDesarrollos
        )
        setDuenios((duenData || []) as Duenio[])
      } catch (err) {
        console.error('Error loading catálogos:', err)
      }
    }
    fetchCatalogos()
  }, [])

  const selectedDevelopment = desarrollos.find(
    (desarrollo) => desarrollo.desarrolloid.toString() === formData.desarrolloid
  )
  const isPanteones = Boolean(
    selectedDevelopment && tipoPanteonesIds.includes(selectedDevelopment.tipodesarrolloid || 0)
  )

  useEffect(() => {
    if (!isPanteones || lote || !formData.zona.trim() || !formData.desarrolloid || !formData.tipolote || !autoClaveKey) {
      return
    }

    let cancelled = false
    const updatePanteonesClave = async () => {
      const baseClave = buildClave(
        formData.desarrolloid,
        formData.coto,
        formData.manzana,
        formData.nolote,
        formData.zona,
        formData.tipolote,
      )
      const { data, error } = await supabase
        .from('lote')
        .select('clavelote')
        .eq('desarrolloid', Number(formData.desarrolloid))
        .eq('tipolote', formData.tipolote)

      if (error || cancelled) return

      const usedNumbers = (data || []).map((existingLot) => {
        const suffix = existingLot.clavelote?.startsWith(`${baseClave}-`)
          ? existingLot.clavelote.slice(baseClave.length + 1)
          : ''
        return /^\d+$/.test(suffix) ? Number(suffix) : 0
      })
      const nextNumber = Math.max(0, ...usedNumbers) + 1
      setFormData((current) => ({
        ...current,
        clavelote: `${baseClave}-${String(nextNumber).padStart(3, '0')}`,
      }))
    }

    updatePanteonesClave()
    return () => {
      cancelled = true
    }
  }, [isPanteones, lote, formData.zona, formData.desarrolloid, formData.tipolote, autoClaveKey])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.desarrolloid) newErrors.desarrolloid = 'Desarrollo requerido'
    if (isPanteones && !formData.zona.trim()) newErrors.zona = 'Zona o sección requerida'
    if (!isPanteones && !formData.manzana.trim()) newErrors.manzana = 'Manzana requerida'
    if (!isPanteones && formData.manzana.length > 2) newErrors.manzana = 'La manzana debe tener máximo 2 caracteres'
    if (!isPanteones && formData.coto.length > 2) newErrors.coto = 'El coto debe tener máximo 2 caracteres'
    if (!isPanteones && !formData.nolote.trim()) newErrors.nolote = 'No. Lote requerido'
    if (formData.clavelote.length > 15) newErrors.clavelote = 'La clave no puede superar 15 caracteres'
    if (!formData.superficie) newErrors.superficie = 'Superficie requerida'
    if (formData.superficie && isNaN(parseFloat(formData.superficie))) {
      newErrors.superficie = 'Debe ser un número'
    }
    if (!formData.preciopormt2) newErrors.preciopormt2 = 'Precio/m² requerido'
    if (formData.preciopormt2 && isNaN(parseFloat(formData.preciopormt2))) {
      newErrors.preciopormt2 = 'Debe ser un número'
    }

    setErrors(newErrors)
    const firstError = Object.keys(newErrors)[0]
    if (firstError) {
      window.setTimeout(() => {
        const field = formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`)
        field?.focus()
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 0)
    }
    return Object.keys(newErrors).length === 0
  }

  const handleSuperficieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (value && formData.preciopormt2) {
      const superficie = parseFloat(value)
      const precioM2 = parseFloat(formData.preciopormt2)
      const precioTotal = superficie * precioM2
      setFormData((prev) => ({
        ...prev,
        superficie: value,
        preciolote: precioTotal.toFixed(2),
      }))
    } else {
      setFormData({ ...formData, superficie: value })
    }
  }

  const handlePrecioM2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (value && formData.superficie) {
      const superficie = parseFloat(formData.superficie)
      const precioM2 = parseFloat(value)
      const precioTotal = superficie * precioM2
      setFormData((prev) => ({
        ...prev,
        preciopormt2: value,
        preciolote: precioTotal.toFixed(2),
      }))
    } else {
      setFormData({ ...formData, preciopormt2: value })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    let clavePanteones = formData.clavelote || null
    if (isPanteones) {
      const baseClave = buildClave(
        formData.desarrolloid,
        formData.coto,
        formData.manzana,
        formData.nolote,
        formData.zona,
        formData.tipolote,
      )
      let existingLotsQuery = supabase
        .from('lote')
        .select('loteid, clavelote')
        .eq('desarrolloid', Number(formData.desarrolloid))
        .eq('tipolote', formData.tipolote)
      if (lote?.loteid) existingLotsQuery = existingLotsQuery.neq('loteid', lote.loteid)
      const { data: existingLots, error: existingLotsError } = await existingLotsQuery

      if (existingLotsError) {
        setErrors((current) => ({ ...current, _form: existingLotsError.message }))
        return
      }

      if (lote?.clavelote?.startsWith(`${baseClave}-`)) {
        clavePanteones = lote.clavelote
      } else {
        const usedNumbers = (existingLots || [])
          .map((existingLot) => {
            const suffix = existingLot.clavelote?.startsWith(`${baseClave}-`)
              ? existingLot.clavelote.slice(baseClave.length + 1)
              : ''
            return /^\d+$/.test(suffix) ? Number(suffix) : 0
          })
        const nextNumber = Math.max(0, ...usedNumbers) + 1
        clavePanteones = `${baseClave}-${String(nextNumber).padStart(3, '0')}`
      }
    }

    const submitData = {
      desarrolloid: formData.desarrolloid ? parseInt(formData.desarrolloid) : null,
      zona: formData.zona || null,
      duenioid: formData.duenioid ? parseInt(formData.duenioid) : null,
      coto: isPanteones ? null : (formData.coto || null),
      manzana: isPanteones ? null : (formData.manzana || null),
      nolote: isPanteones ? null : (formData.nolote || null),
      clavelote: clavePanteones,
      tipolote: formData.tipolote || null,
      linderonte: formData.linderonte ? parseFloat(formData.linderonte) : null,
      colindanciante: formData.colindanciante || null,
      linderosur: formData.linderosur ? parseFloat(formData.linderosur) : null,
      colindanciasur: formData.colindanciasur || null,
      linderoote: formData.linderoote ? parseFloat(formData.linderoote) : null,
      colindanciaote: formData.colindanciaote || null,
      linderopte: formData.linderopte ? parseFloat(formData.linderopte) : null,
      colindanciapte: formData.colindanciapte || null,
      superficie: formData.superficie ? parseFloat(formData.superficie) : null,
      preciopormt2: formData.preciopormt2 ? parseFloat(formData.preciopormt2) : null,
      preciolote: formData.preciolote ? parseFloat(formData.preciolote) : null,
      estatus: formData.estatus,
      comentarios: formData.comentarios || null,
    }

    try {
      await onSubmit(submitData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el lote.'
      setErrors((current) => ({
        ...current,
        _form: message,
      }))
      window.setTimeout(() => {
        const field = formRef.current?.querySelector<HTMLElement>('[name="coto"], [name="manzana"], [name="nolote"]')
        field?.focus()
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 0)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="admin-form space-y-6">
      {/* Row 1: Desarrollo, Dueño, Tipo Lote */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isPanteones && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Zona o sección *
          </label>
          <Input
            name="zona"
            type="text"
            value={formData.zona}
            onChange={(e) => {
              const zona = e.target.value
              setFormData(prev => ({
                ...prev,
                zona,
                ...(autoClaveKey ? { clavelote: buildClave(prev.desarrolloid, prev.coto, prev.manzana, prev.nolote, zona) } : {}),
              }))
            }}
            placeholder="Ej: Sección Jardines"
            disabled={isLoading}
          />
          {errors.zona && <p className="text-red-500 text-sm mt-1">{errors.zona}</p>}
        </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Desarrollo *
          </label>
          <select
            name="desarrolloid"
            value={formData.desarrolloid}
            onChange={(e) => {
              const id = e.target.value
              const clave = buildClave(id, formData.coto, formData.manzana, formData.nolote)
              setFormData(prev => ({ ...prev, desarrolloid: id, ...(autoClaveKey ? { clavelote: clave } : {}) }))
            }}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
          >
            <option value="">Selecciona un desarrollo</option>
            {desarrollos.map((d) => (
              <option key={d.desarrolloid} value={d.desarrolloid}>
                {d.nombre} ({d.clavedesarrollo})
              </option>
            ))}
          </select>
          {errors.desarrolloid && <p className="text-red-500 text-sm mt-1">{errors.desarrolloid}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dueño
          </label>
          <select
            name="duenioid"
            value={formData.duenioid}
            onChange={(e) => setFormData({ ...formData, duenioid: e.target.value })}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
          >
            <option value="">Sin dueño</option>
            {duenios.map((d) => (
              <option key={d.duenioid} value={d.duenioid}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Lote
          </label>
          <select
            value={formData.tipolote}
            onChange={(e) => {
              const tipolote = e.target.value
              setFormData(prev => ({
                ...prev,
                tipolote,
                ...(autoClaveKey ? { clavelote: buildClave(prev.desarrolloid, prev.coto, prev.manzana, prev.nolote, prev.zona, tipolote) } : {}),
              }))
            }}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
          >
            <option value="Habitacional">Habitacional</option>
            <option value="Comercial">Comercial</option>
            <option value="Rústico">Rústico</option>
            <option value="Gaveta">Gaveta</option>
            <option value="Cripta">Cripta</option>
            <option value="Nicho">Nicho</option>
          </select>
        </div>
      </div>

      {/* Row 2: Coto, Manzana, No. Lote, Estado */}
      {!isPanteones && <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Coto
          </label>
          <Input
            name="coto"
            type="text"
            value={formData.coto}
            onChange={(e) => {
              const val = e.target.value
              const clave = buildClave(formData.desarrolloid, val, formData.manzana, formData.nolote)
              setFormData(prev => ({ ...prev, coto: val, ...(autoClaveKey ? { clavelote: clave } : {}) }))
            }}
            placeholder="Ej: 01, 00"
            maxLength={2}
            disabled={isLoading}
          />
          {errors.coto && <p className="text-red-500 text-sm mt-1">{errors.coto}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Manzana *
          </label>
          <Input
            name="manzana"
            type="text"
            value={formData.manzana}
            onChange={(e) => {
              const val = e.target.value
              const clave = buildClave(formData.desarrolloid, formData.coto, val, formData.nolote)
              setFormData(prev => ({ ...prev, manzana: val, ...(autoClaveKey ? { clavelote: clave } : {}) }))
            }}
            placeholder="Ej: 02, 03"
            maxLength={2}
            disabled={isLoading}
          />
          {errors.manzana && <p className="text-red-500 text-sm mt-1">{errors.manzana}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            No. Lote *
          </label>
          <Input
            name="nolote"
            type="text"
            value={formData.nolote}
            onChange={(e) => {
              const val = e.target.value
              const clave = buildClave(formData.desarrolloid, formData.coto, formData.manzana, val)
              setFormData(prev => ({ ...prev, nolote: val, ...(autoClaveKey ? { clavelote: clave } : {}) }))
            }}
            placeholder="Ej: 001, 002"
            disabled={isLoading}
          />
          {errors.nolote && <p className="text-red-500 text-sm mt-1">{errors.nolote}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado *
          </label>
          <select
            value={formData.estatus}
            onChange={(e) => setFormData({ ...formData, estatus: e.target.value })}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
          >
            <option value="D">Disponible</option>
            <option value="A">Apartado</option>
            <option value="V">Vendido</option>
            <option value="B">Bloqueado</option>
            <option value="N">No disponible</option>
          </select>
        </div>
      </div>}

      {/* Clave del lote */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Clave del Lote
        </label>
        <div className="flex items-center gap-2">
          <Input
            name="clavelote"
            type="text"
            value={formData.clavelote}
            onChange={(e) => {
              setAutoClaveKey(false)
              setFormData(prev => ({ ...prev, clavelote: e.target.value }))
            }}
            placeholder="Ej: PUB-01-03-009"
            maxLength={15}
            disabled={isLoading}
            className="font-mono"
          />
          <button
            type="button"
            onClick={() => {
              setAutoClaveKey(true)
              setFormData(prev => ({ ...prev, clavelote: buildClave(prev.desarrolloid, prev.coto, prev.manzana, prev.nolote) }))
            }}
            className="whitespace-nowrap text-xs px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
            title="Regenerar clave automáticamente"
          >
            Auto
          </button>
        </div>
        {errors.clavelote && <p className="mt-1 text-sm text-red-500">{errors.clavelote}</p>}
        <p className="text-xs text-gray-400 mt-1">Se genera automáticamente. Puedes editar manualmente o pulsar Auto para regenerar.</p>
      </div>

      {/* Row 3: Medidas (Linderos) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Linderos y Colindancias</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lindero Norte (m)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.linderonte}
              onChange={(e) => setFormData({ ...formData, linderonte: e.target.value })}
              placeholder="0.00"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colindancia Norte
            </label>
            <Input
              type="text"
              value={formData.colindanciante}
              onChange={(e) => setFormData({ ...formData, colindanciante: e.target.value })}
              placeholder="Ej: Calle San Antonio"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lindero Sur (m)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.linderosur}
              onChange={(e) => setFormData({ ...formData, linderosur: e.target.value })}
              placeholder="0.00"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colindancia Sur
            </label>
            <Input
              type="text"
              value={formData.colindanciasur}
              onChange={(e) => setFormData({ ...formData, colindanciasur: e.target.value })}
              placeholder="Ej: Lote 15"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lindero Este (m)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.linderoote}
              onChange={(e) => setFormData({ ...formData, linderoote: e.target.value })}
              placeholder="0.00"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colindancia Este
            </label>
            <Input
              type="text"
              value={formData.colindanciaote}
              onChange={(e) => setFormData({ ...formData, colindanciaote: e.target.value })}
              placeholder="Ej: Lote 2"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lindero Oeste (m)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.linderopte}
              onChange={(e) => setFormData({ ...formData, linderopte: e.target.value })}
              placeholder="0.00"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colindancia Oeste
            </label>
            <Input
              type="text"
              value={formData.colindanciapte}
              onChange={(e) => setFormData({ ...formData, colindanciapte: e.target.value })}
              placeholder="Ej: Lote 4"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Row 4: Precios y Superficie */}
      {errors._form && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors._form}
        </p>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Valores del Lote</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Superficie (m²) *
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.superficie}
              onChange={handleSuperficieChange}
              placeholder="0.00"
              disabled={isLoading}
            />
            {errors.superficie && <p className="text-red-500 text-sm mt-1">{errors.superficie}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio/m² *
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.preciopormt2}
              onChange={handlePrecioM2Change}
              placeholder="0.00"
              disabled={isLoading}
            />
            {errors.preciopormt2 && <p className="text-red-500 text-sm mt-1">{errors.preciopormt2}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio Total
            </label>
            <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
              <p className="text-lg font-semibold text-gray-900">
                {formData.preciolote ? formatCurrency(parseFloat(formData.preciolote)) : '$0.00'}
              </p>
            </div>
            <p className="text-xs text-green-600 mt-1">Auto-calculado (Superficie × Precio/m²)</p>
          </div>
        </div>
      </div>

      {/* Comentarios */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comentarios
        </label>
        <textarea
          value={formData.comentarios}
          onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
          placeholder="Notas adicionales"
          rows={3}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="px-6"
        >
          {isLoading ? 'Guardando...' : lote ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}
