import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DesarrolloForm } from '@/components/forms/DesarrolloForm'
import { ChevronLeft, Edit2, Trash2 } from 'lucide-react'
import type { Desarrollo, Lote, TipoDesarrollo } from '@/types/database'
import { getStatusLabel, getLoteStatusLabel, getLoteStatusColor, formatCurrency } from '@/utils/helpers'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES, type AdminPanelRole } from '@/config/roles'

interface DesarrolloWithTipo extends Desarrollo {
  tipodesarrollo?: TipoDesarrollo
}

export const DesarrolloDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [desarrollo, setDesarrollo] = useState<DesarrolloWithTipo | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const currentRole = role && role in ROLE_CAPABILITIES ? (role as AdminPanelRole) : null
  const canEditDesarrollos = !!currentRole && ROLE_CAPABILITIES[currentRole].editar_desarrollos

  const fetchDesarrolloDetail = async () => {
    if (!id) return
    try {
      setLoading(true)

      // Fetch desarrollo
      const { data: desarrolloData, error: desarrolloError } = await supabase
        .from('desarrollo')
        .select('*')
        .eq('desarrolloid', id)
        .single()

      if (desarrolloError) throw desarrolloError
      setDesarrollo(desarrolloData)

      // Fetch associated lotes
      const { data: lotesData, error: lotesError } = await supabase
        .from('lote')
        .select('*')
        .eq('desarrolloid', id)
        .order('manzana', { ascending: true })
        .order('nolote', { ascending: true })

      if (lotesError) throw lotesError
      setLotes(lotesData || [])
    } catch (error) {
      console.error('Error fetching desarrollo detail:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDesarrolloDetail()
  }, [id])

  const handleFormSubmit = async (formData: any) => {
    if (!canEditDesarrollos) {
      alert('Tu rol solo puede consultar desarrollos.')
      return
    }
    try {
      setFormLoading(true)

      const { error } = await supabase
        .from('desarrollo')
        .update(formData)
        .eq('desarrolloid', id)

      if (error) throw error

      setIsEditModalOpen(false)
      await fetchDesarrolloDetail()
    } catch (error) {
      console.error('Error updating desarrollo:', error)
      alert('Error al actualizar el desarrollo')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!canEditDesarrollos) {
      alert('Tu rol no tiene permiso para eliminar desarrollos.')
      return
    }
    try {
      setDeleteLoading(true)

      // Check if there are associated lotes
      if (lotes.length > 0) {
        alert('No se puede eliminar el desarrollo porque tiene lotes asociados. Elimina primero los lotes.')
        return
      }

      const { error } = await supabase
        .from('desarrollo')
        .delete()
        .eq('desarrolloid', id)

      if (error) throw error

      navigate('/admin/desarrollos')
    } catch (error) {
      console.error('Error deleting desarrollo:', error)
      alert('Error al eliminar el desarrollo')
    } finally {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
            <p className="mt-4 text-[#9e9f92]">Cargando detalles...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!desarrollo) {
    return (
      <AdminLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          No se encontró el desarrollo
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/desarrollos')}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Volver
          </Button>
          {canEditDesarrollos && (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsEditModalOpen(true)}
                className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold inline-flex items-center gap-2"
              >
                <Edit2 size={18} />
                Editar
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center gap-2"
              >
                <Trash2 size={18} />
                Eliminar
              </Button>
            </div>
          )}
        </div>

        {/* Development Details */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-8 border-t-4 border-[#504840]">
          <h1 className="text-3xl font-bold text-black mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            {desarrollo.nombre}
          </h1>

          {/* Section 1: General Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Información General</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">ID</p>
                <p className="text-sm font-bold text-gray-900">{desarrollo.desarrolloid}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Clave</p>
                <p className="text-sm font-bold text-gray-900">{desarrollo.clavedesarrollo}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Tipo</p>
                <p className="text-sm font-bold text-gray-900">
                  {desarrollo.tipodesarrolloid === 4 ? 'Ejidal' : desarrollo.tipodesarrolloid === 5 ? 'Propiedad' : '-'}
                </p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Total Lotes</p>
                <p className="text-sm font-bold text-gray-900">{lotes.length}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Status & Descriptions */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Descripción</h2>
            <div className="space-y-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Descripción Corta</p>
                <p className="text-sm font-bold text-gray-900">{desarrollo.descripcion || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Descripción Detallada</p>
                <p className="text-sm text-gray-900">{desarrollo.descripciondetallada || '-'}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Economy */}
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Valores Financieros</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Monto Mínimo Apartado</p>
                <p className="text-sm font-bold text-gray-900">{desarrollo.montominimoapartado || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Enganche</p>
                <p className="text-sm font-bold text-gray-900">{desarrollo.enganche || '-'}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-gray-600">Estado</p>
                <span className={`text-xs font-bold inline-block px-2 py-1 rounded-full ${
                  desarrollo.estatus === 'A'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {getStatusLabel(desarrollo.estatus)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lotes associated */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 md:px-8 py-4 md:py-6 border-b border-gray-200">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Lotes Asociados</h2>
          </div>

          {lotes.length === 0 ? (
            <div className="px-8 py-12 text-center text-gray-500">
              No hay lotes asociados a este desarrollo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#504840] border-b border-[#504840]">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Manzana</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Lote</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Precio</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Estado</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lotes.map((lote) => (
                    <tr key={lote.loteid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700">{lote.manzana}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{lote.nolote}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(lote.preciolote)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getLoteStatusColor(lote.estatus)}`}>
                          {getLoteStatusLabel(lote.estatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/lotes/${lote.loteid}`, { state: { from: `/admin/desarrollos/${id}` } })}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal para editar */}
      <Modal
        isOpen={isEditModalOpen}
        title="Editar Desarrollo"
        onClose={() => setIsEditModalOpen(false)}
        size="xl"
      >
        <DesarrolloForm
          desarrollo={desarrollo}
          onSubmit={handleFormSubmit}
          isLoading={formLoading}
        />
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        isOpen={showDeleteConfirm}
        title="Confirmar eliminación"
        onClose={() => setShowDeleteConfirm(false)}
      >
        <div className="text-center">
          <p className="text-gray-700 mb-6">
            ¿Estás seguro de que deseas eliminar el desarrollo <strong>{desarrollo.nombre}</strong>?
          </p>
          <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outline"
              className="px-6 py-2"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2"
            >
              {deleteLoading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
