import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Desarrollo, TipoDesarrollo } from '@/types/database'

interface DesarrolloFormProps {
  desarrollo?: Desarrollo | null
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const DesarrolloForm = ({ desarrollo, onSubmit, isLoading = false }: DesarrolloFormProps) => {
  const [formData, setFormData] = useState({
    clavedesarrollo: '',
    nombre: '',
    descripcion: '',
    descripciondetallada: '',
    tipodesarrolloid: '',
    estatus: 'A',
    montominimoapartado: '',
    enganche: '',
  })
  const [tiposDesarrollo, setTiposDesarrollo] = useState<TipoDesarrollo[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load existing data if editing
    if (desarrollo) {
      setFormData({
        clavedesarrollo: desarrollo.clavedesarrollo || '',
        nombre: desarrollo.nombre || '',
        descripcion: desarrollo.descripcion || '',
        descripciondetallada: desarrollo.descripciondetallada || '',
        tipodesarrolloid: desarrollo.tipodesarrolloid?.toString() || '',
        estatus: desarrollo.estatus || 'A',
        montominimoapartado: desarrollo.montominimoapartado?.toString() || '',
        enganche: desarrollo.enganche?.toString() || '',
      })
    }
  }, [desarrollo])

  useEffect(() => {
    // Load tipos de desarrollo
    const fetchTipos = async () => {
      try {
        const { data, error } = await supabase.from('tipodesarrollo').select('tipodesarrolloid, descripcion').order('descripcion')
        
        if (error) throw error
        
        setTiposDesarrollo(data || [])
      } catch (err) {
        console.error('Error loading tipos:', err)
      }
    }
    fetchTipos()
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.clavedesarrollo.trim()) newErrors.clavedesarrollo = 'Clave requerida'
    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido'
    if (!formData.tipodesarrolloid) newErrors.tipodesarrolloid = 'Tipo requerido'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const submitData = {
      ...formData,
      tipodesarrolloid: formData.tipodesarrolloid ? parseInt(formData.tipodesarrolloid) : null,
      montominimoapartado: formData.montominimoapartado || null,
      enganche: formData.enganche || null,
    }

    try {
      await onSubmit(submitData)
    } catch (err) {
      console.error('Error submitting form:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clave de Desarrollo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clave de Desarrollo *
          </label>
          <Input
            type="text"
            value={formData.clavedesarrollo}
            onChange={(e) => setFormData({ ...formData, clavedesarrollo: e.target.value })}
            placeholder="Ej: VIS, MI4"
            disabled={isLoading}
          />
          {errors.clavedesarrollo && (
            <p className="text-red-500 text-sm mt-1">{errors.clavedesarrollo}</p>
          )}
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre *
          </label>
          <Input
            type="text"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Ej: Vistas del Cielo"
            disabled={isLoading}
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
        </div>

        {/* Tipo de Desarrollo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Desarrollo *
          </label>
          <select
            value={formData.tipodesarrolloid}
            onChange={(e) => setFormData({ ...formData, tipodesarrolloid: e.target.value })}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
          >
            <option value="">Selecciona un tipo</option>
            {tiposDesarrollo.map((tipo) => (
              <option key={tipo.tipodesarrolloid} value={tipo.tipodesarrolloid}>
                {tipo.descripcion}
              </option>
            ))}
          </select>
          {errors.tipodesarrolloid && (
            <p className="text-red-500 text-sm mt-1">{errors.tipodesarrolloid}</p>
          )}
        </div>

        {/* Estatus */}
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
            <option value="A">Activo</option>
            <option value="I">Inactivo</option>
            <option value="V">Vendido</option>
          </select>
        </div>

        {/* Monto Mínimo Apartado */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monto Mínimo Apartado
          </label>
          <Input
            type="number"
            step="0.01"
            value={formData.montominimoapartado}
            onChange={(e) => setFormData({ ...formData, montominimoapartado: e.target.value })}
            placeholder="0.00"
            disabled={isLoading}
          />
          {errors.montominimoapartado && (
            <p className="text-red-500 text-sm mt-1">{errors.montominimoapartado}</p>
          )}
        </div>

        {/* Enganche */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enganche
          </label>
          <Input
            type="number"
            step="0.01"
            value={formData.enganche}
            onChange={(e) => setFormData({ ...formData, enganche: e.target.value })}
            placeholder="0.00"
            disabled={isLoading}
          />
          {errors.enganche && (
            <p className="text-red-500 text-sm mt-1">{errors.enganche}</p>
          )}
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción
        </label>
        <textarea
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          placeholder="Descripción breve"
          rows={3}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
        />
      </div>

      {/* Descripción Detallada */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción Detallada
        </label>
        <textarea
          value={formData.descripciondetallada}
          onChange={(e) => setFormData({ ...formData, descripciondetallada: e.target.value })}
          placeholder="Descripción larga con características"
          rows={4}
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
          {isLoading ? 'Guardando...' : desarrollo ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}
