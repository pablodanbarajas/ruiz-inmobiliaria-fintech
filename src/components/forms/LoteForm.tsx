import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Lote, Desarrollo, Duenio } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'

interface LoteFormProps {
  lote?: Lote | null
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const LoteForm = ({ lote, onSubmit, isLoading = false }: LoteFormProps) => {
  const [formData, setFormData] = useState({
    desarrolloid: '',
    duenioid: '',
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
  const [duenios, setDuenios] = useState<Duenio[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [calcularPrecio, setCalcularPrecio] = useState(!lote)

  useEffect(() => {
    if (lote) {
      setFormData({
        desarrolloid: lote.desarrolloid?.toString() || '',
        duenioid: lote.duenioid?.toString() || '',
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
      setCalcularPrecio(false)
    }
  }, [lote])

  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const [{ data: desData }, { data: duenData }] = await Promise.all([
          supabase.from('desarrollo').select('desarrolloid, nombre, clavedesarrollo, estatus, tipodesarrolloid').order('nombre'),
          supabase.from('duenio').select('duenioid, nombre, contacto').order('nombre'),
        ])

        setDesarrollos((desData || []) as Desarrollo[])
        setDuenios((duenData || []) as Duenio[])
      } catch (err) {
        console.error('Error loading catálogos:', err)
      }
    }
    fetchCatalogos()
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.desarrolloid) newErrors.desarrolloid = 'Desarrollo requerido'
    if (!formData.manzana.trim()) newErrors.manzana = 'Manzana requerida'
    if (!formData.nolote.trim()) newErrors.nolote = 'No. Lote requerido'
    if (!formData.superficie) newErrors.superficie = 'Superficie requerida'
    if (formData.superficie && isNaN(parseFloat(formData.superficie))) {
      newErrors.superficie = 'Debe ser un número'
    }
    if (!formData.preciopormt2) newErrors.preciopormt2 = 'Precio/m² requerido'
    if (formData.preciopormt2 && isNaN(parseFloat(formData.preciopormt2))) {
      newErrors.preciopormt2 = 'Debe ser un número'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSuperficieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, superficie: value })

    if (calcularPrecio && value && formData.preciopormt2) {
      const superficie = parseFloat(value)
      const precioM2 = parseFloat(formData.preciopormt2)
      const precioTotal = superficie * precioM2
      setFormData((prev) => ({
        ...prev,
        preciolote: precioTotal.toFixed(2),
      }))
    }
  }

  const handlePrecioM2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, preciopormt2: value })

    if (calcularPrecio && value && formData.superficie) {
      const superficie = parseFloat(formData.superficie)
      const precioM2 = parseFloat(value)
      const precioTotal = superficie * precioM2
      setFormData((prev) => ({
        ...prev,
        preciolote: precioTotal.toFixed(2),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const submitData = {
      desarrolloid: formData.desarrolloid ? parseInt(formData.desarrolloid) : null,
      duenioid: formData.duenioid ? parseInt(formData.duenioid) : null,
      coto: formData.coto || null,
      manzana: formData.manzana || null,
      nolote: formData.nolote || null,
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
      console.error('Error submitting form:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1: Desarrollo, Dueño, Tipo Lote */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Desarrollo *
          </label>
          <select
            value={formData.desarrolloid}
            onChange={(e) => setFormData({ ...formData, desarrolloid: e.target.value })}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
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
            value={formData.duenioid}
            onChange={(e) => setFormData({ ...formData, duenioid: e.target.value })}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
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
            onChange={(e) => setFormData({ ...formData, tipolote: e.target.value })}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
          >
            <option value="Habitacional">Habitacional</option>
            <option value="Comercial">Comercial</option>
            <option value="Rústico">Rústico</option>
          </select>
        </div>
      </div>

      {/* Row 2: Coto, Manzana, No. Lote, Estado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Coto
          </label>
          <Input
            type="text"
            value={formData.coto}
            onChange={(e) => setFormData({ ...formData, coto: e.target.value })}
            placeholder="Ej: 01, 00"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Manzana *
          </label>
          <Input
            type="text"
            value={formData.manzana}
            onChange={(e) => setFormData({ ...formData, manzana: e.target.value })}
            placeholder="Ej: 02, 03"
            disabled={isLoading}
          />
          {errors.manzana && <p className="text-red-500 text-sm mt-1">{errors.manzana}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            No. Lote *
          </label>
          <Input
            type="text"
            value={formData.nolote}
            onChange={(e) => setFormData({ ...formData, nolote: e.target.value })}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
          >
            <option value="D">Disponible</option>
            <option value="A">Apartado</option>
            <option value="V">Vendido</option>
            <option value="B">Bloqueado</option>
            <option value="N">No disponible</option>
          </select>
        </div>
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
            {calcularPrecio && (
              <p className="text-xs text-green-600 mt-1">Auto-calculado (Superficie × Precio/m²)</p>
            )}
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-2 px-6"
        >
          {isLoading ? 'Guardando...' : lote ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}
