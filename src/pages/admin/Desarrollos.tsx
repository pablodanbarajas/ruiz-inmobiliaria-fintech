import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached } from '@/lib/queryCache'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DesarrolloForm } from '@/components/forms/DesarrolloForm'
import { Eye, Plus, Edit2, Trash2, Map } from 'lucide-react'
import type { Desarrollo, TipoDesarrollo } from '@/types/database'
import { getStatusLabel } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES, type AdminPanelRole } from '@/config/roles'

interface DesarrolloWithTipo extends Desarrollo {
  tipodesarrollo?: TipoDesarrollo
}

export const Desarrollos = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [desarrollos, setDesarrollos] = useState<DesarrolloWithTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDesarrollo, setEditingDesarrollo] = useState<Desarrollo | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [desarrolloToDelete, setDesarrolloToDelete] = useState<Desarrollo | null>(null)

  const currentRole = role && role in ROLE_CAPABILITIES ? (role as AdminPanelRole) : null
  const canEditDesarrollos = !!currentRole && ROLE_CAPABILITIES[currentRole].editar_desarrollos

  const fetchDesarrollos = async (bypass = false) => {
    const ck = `desarrollos:${searchTerm}:${statusFilter}`
    if (!bypass) { const c = getCached<DesarrolloWithTipo[]>(ck); if (c) { setDesarrollos(c); setLoading(false); return } }
    try {
      setLoading(true)
      let query = supabase.from('desarrollo').select('*').order('nombre', { ascending: true })

      if (statusFilter) {
        query = query.eq('estatus', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error

      let filteredData = data || []
      if (DEMO_DESARROLLOIDS.length > 0) {
        filteredData = filteredData.filter(
          (d: DesarrolloWithTipo) => DEMO_DESARROLLOIDS.includes(d.desarrolloid)
        )
      }
      if (searchTerm) {
        filteredData = filteredData.filter(
          (d: DesarrolloWithTipo) =>
            d.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.clavedesarrollo?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setCached(ck, filteredData)
      setDesarrollos(filteredData)
    } catch (error) {
      console.error('Error fetching desarrollos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDesarrollos()
  }, [searchTerm, statusFilter])

  const handleOpenModal = (desarrollo?: Desarrollo) => {
    if (!canEditDesarrollos) {
      alert('Tu rol solo puede consultar desarrollos.')
      return
    }
    setEditingDesarrollo(desarrollo || null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingDesarrollo(null)
  }

  const handleDeleteDesarrollo = async () => {
    if (!canEditDesarrollos) {
      alert('Tu rol no tiene permiso para eliminar desarrollos.')
      return
    }
    if (!desarrolloToDelete) return
    try {
      setFormLoading(true)

      // Check if there are associated lotes
      const { data: lotesCount } = await supabase
        .from('lote')
        .select('loteid', { count: 'exact' })
        .eq('desarrolloid', desarrolloToDelete.desarrolloid)

      if (lotesCount && lotesCount.length > 0) {
        alert('No se puede eliminar el desarrollo porque tiene lotes asociados. Elimina primero los lotes.')
        setShowDeleteConfirm(false)
        setFormLoading(false)
        return
      }

      const { error } = await supabase
        .from('desarrollo')
        .delete()
        .eq('desarrolloid', desarrolloToDelete.desarrolloid)

      if (error) throw error

      setShowDeleteConfirm(false)
      setDesarrolloToDelete(null)
      await fetchDesarrollos()
    } catch (error: any) {
      console.error('Error deleting desarrollo:', error)
      alert('Error al eliminar el desarrollo: ' + (error?.message || JSON.stringify(error)))
    } finally {
      setFormLoading(false)
    }
  }

  const handleFormSubmit = async (formData: any) => {
    if (!canEditDesarrollos) {
      alert('Tu rol no tiene permiso para modificar desarrollos.')
      return
    }
    try {
      setFormLoading(true)

      if (editingDesarrollo) {
        // UPDATE
        const { error } = await supabase
          .from('desarrollo')
          .update(formData)
          .eq('desarrolloid', editingDesarrollo.desarrolloid)

        if (error) throw error
      } else {
        // CREATE
        const { error } = await supabase.from('desarrollo').insert([formData])

        if (error) throw error
      }

      handleCloseModal()
      await fetchDesarrollos()
    } catch (error: any) {
      console.error('Error saving desarrollo:', error)
      alert('Error al guardar el desarrollo: ' + (error?.message || JSON.stringify(error)))
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Desarrollos</h1>
            <p className="text-[#9e9f92] mt-2">Listado de proyectos inmobiliarios</p>
          </div>
          {canEditDesarrollos && (
            <Button
              onClick={() => handleOpenModal()}
              className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Nuevo Desarrollo
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Buscar por nombre o clave
              </label>
              <Input
                placeholder="Ej: Mirador, MI4..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Estado
              </label>
              <select
                className="w-full px-3 py-2 border border-[#504840] rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="A">Activo</option>
                <option value="I">Inactivo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable<DesarrolloWithTipo>
          emptyMessage="No se encontraron desarrollos con los filtros aplicados"
          columns={[
            {
              key: 'clavedesarrollo',
              label: 'Clave',
              width: 'w-20',
            },
            {
              key: 'nombre',
              label: 'Nombre',
            },
            {
              key: 'estatus',
              label: 'Estado',
              render: (row: DesarrolloWithTipo) => (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  row.estatus === 'A'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {getStatusLabel(row.estatus)}
                </span>
              ),
            },
            {
              key: 'tipodesarrolloid',
              label: 'Tipo',
              render: (row: DesarrolloWithTipo) => {
                const tipos: { [key: number]: string } = {
                  4: 'Ejidal',
                  5: 'Propiedad',
                }
                return tipos[row.tipodesarrolloid || 0] || '-'
              },
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row: DesarrolloWithTipo) => (
                <div className="flex gap-2">
                  {canEditDesarrollos && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenModal(row)}
                      className="inline-flex items-center gap-1"
                      title="Editar desarrollo"
                    >
                      <Edit2 size={16} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/desarrollos/${row.desarrolloid}`)}
                    className="inline-flex items-center gap-1"
                    title="Ver detalles"
                  >
                    <Eye size={16} />
                  </Button>
                  {canEditDesarrollos && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDesarrolloToDelete(row)
                        setShowDeleteConfirm(true)
                      }}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      title="Eliminar desarrollo"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                  {row.desarrolloid === 11 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/admin/mapa')}
                      className="inline-flex items-center gap-1 text-[#eaae4c] hover:text-[#d99c38]"
                      title="Ver mapa de lotes"
                    >
                      <Map size={16} />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          data={desarrollos}
          loading={loading}
        />
      </div>

      {/* Modal para crear/editar */}
      <Modal
        isOpen={isModalOpen}
        title={editingDesarrollo ? 'Editar Desarrollo' : 'Nuevo Desarrollo'}
        onClose={handleCloseModal}
      >
        <DesarrolloForm
          desarrollo={editingDesarrollo}
          onSubmit={handleFormSubmit}
          isLoading={formLoading}
        />
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        isOpen={showDeleteConfirm}
        title="Eliminar Desarrollo"
        onClose={() => setShowDeleteConfirm(false)}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar el desarrollo <strong>{desarrolloToDelete?.nombre}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-4 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={formLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteDesarrollo}
              disabled={formLoading}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6"
            >
              {formLoading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
