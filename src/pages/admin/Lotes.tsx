import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached } from '@/lib/queryCache'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoteForm } from '@/components/forms/LoteForm'
import { Eye, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lote, Desarrollo } from '@/types/database'
import { getLoteStatusLabel, getLoteStatusColor, formatCurrency } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES, type AdminPanelRole } from '@/config/roles'

export const Lotes = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [lotes, setLotes] = useState<(Lote & { desarrollo?: Desarrollo })[]>([])
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const itemsPerPage = 10

  const [filters, setFilters] = usePersistedFilters('lotesFilters', {
    desarrolloId: '',
    status: '',
    minPrice: '',
    maxPrice: '',
  })

  const [prevFilters, setPrevFilters] = useState(filters)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loteEnEdicion, setLoteEnEdicion] = useState<Lote | null>(null)

  const currentRole = role && role in ROLE_CAPABILITIES ? (role as AdminPanelRole) : null
  const canEditLotes = !!currentRole && ROLE_CAPABILITIES[currentRole].editar_lotes

  // Load desarrollos on mount
  useEffect(() => {
    const fetchDesarrollos = async () => {
      const { data } = await supabase
        .from('desarrollo')
        .select('*')
        .order('nombre', { ascending: true })
      if (data) setDesarrollos(
        DEMO_DESARROLLOIDS.length > 0
          ? data.filter((d) => DEMO_DESARROLLOIDS.includes(d.desarrolloid))
          : data
      )
    }
    fetchDesarrollos()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  useEffect(() => {
    const fetchLotes = async () => {
      const ck = `lotes:${JSON.stringify(filters)}:${currentPage}`
      const cached = getCached<any[]>(ck)
      if (cached) { setLotes(cached); setLoading(false); return }
      try {
        setLoading(true)
        let query = supabase
          .from('lote')
          .select('*, desarrollo:desarrollo(*)') 
          .order('manzana', { ascending: true })
          .order('nolote', { ascending: true })

        if (DEMO_DESARROLLOIDS.length > 0) {
          if (filters.desarrolloId && DEMO_DESARROLLOIDS.includes(Number(filters.desarrolloId))) {
            query = query.eq('desarrolloid', filters.desarrolloId)
          } else {
            query = query.in('desarrolloid', DEMO_DESARROLLOIDS)
          }
        } else if (filters.desarrolloId) {
          query = query.eq('desarrolloid', filters.desarrolloId)
        }
        if (filters.status) {
          query = query.eq('estatus', filters.status)
        }

        const { data, error } = await query

        if (error) throw error

        let filteredData = (data || []) as any[]
        if (filters.minPrice) {
          filteredData = filteredData.filter(
            (l) => (l.preciolote || 0) >= parseFloat(filters.minPrice)
          )
        }
        if (filters.maxPrice) {
          filteredData = filteredData.filter(
            (l) => (l.preciolote || 0) <= parseFloat(filters.maxPrice)
          )
        }

        setTotalItems(filteredData.length)

        // Apply pagination
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        const paginatedData = filteredData.slice(startIndex, endIndex)
        setCached(ck, paginatedData)
        setLotes(paginatedData)
      } catch (error) {
        console.error('Error fetching lotes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLotes()
  }, [filters, currentPage, reloadKey])

  const handleCreateLote = async (formData: any) => {
    if (!canEditLotes) {
      alert('Tu rol solo puede consultar lotes.')
      return
    }
    try {
      setIsSubmitting(true)
      const { error } = await supabase.from('lote').insert([formData])

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setShowModal(false)
      setCurrentPage(1)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('Error creating lote:', err)
      alert('Error al crear el lote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditLote = (lote: Lote) => {
    if (!canEditLotes) {
      alert('Tu rol no tiene permiso para editar lotes.')
      return
    }
    setLoteEnEdicion(lote)
    setShowEditModal(true)
  }

  const handleUpdateLote = async (formData: any) => {
    if (!canEditLotes) {
      alert('Tu rol no tiene permiso para modificar lotes.')
      return
    }
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from('lote')
        .update(formData)
        .eq('loteid', loteEnEdicion?.loteid)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setShowEditModal(false)
      setLoteEnEdicion(null)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('Error updating lote:', err)
      alert('Error al actualizar el lote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLote = async () => {
    if (!canEditLotes) {
      alert('Tu rol no tiene permiso para eliminar lotes.')
      return
    }
    try {
      setIsSubmitting(true)

      // Check if there are any ventas
      const { data: ventasCount } = await supabase
        .from('venta')
        .select('ventaid', { count: 'exact' })
        .eq('loteid', loteEnEdicion?.loteid)

      if (ventasCount && ventasCount.length > 0) {
        alert('No se puede eliminar un lote que tiene ventas asociadas')
        setShowDeleteConfirm(false)
        setIsSubmitting(false)
        return
      }

      const { error } = await supabase
        .from('lote')
        .delete()
        .eq('loteid', loteEnEdicion?.loteid)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setShowDeleteConfirm(false)
      setLoteEnEdicion(null)
      setCurrentPage(1)
      setReloadKey((k) => k + 1)
    } catch (err) {
      console.error('Error deleting lote:', err)
      alert('Error al eliminar el lote')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Lotes</h1>
            <p className="text-[#9e9f92] mt-2">Listado de terrenos disponibles</p>
          </div>
          {canEditLotes && (
            <Button
              onClick={() => setShowModal(true)}
              className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-2 px-6"
            >
              + Nuevo Lote
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Desarrollo
              </label>
              <select
                className="w-full px-3 py-2 border border-[#504840] rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={filters.desarrolloId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, desarrolloId: e.target.value })}
              >
                <option value="">Todos</option>
                {desarrollos.map((d) => (
                  <option key={d.desarrolloid} value={d.desarrolloid}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Estado
              </label>
              <select
                className="w-full px-3 py-2 border border-[#504840] rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={filters.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="D">Disponible</option>
                <option value="V">Vendido</option>
                <option value="B">Bloqueado</option>
                <option value="A">Apartado</option>
                <option value="N">No disponible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Precio Mínimo
              </label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, minPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Precio Máximo
              </label>
              <Input
                type="number"
                placeholder="999999"
                value={filters.maxPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, maxPrice: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable<Lote & { desarrollo?: Desarrollo }>
          emptyMessage="No se encontraron lotes con los filtros aplicados"
          columns={[
            {
              key: 'clavedesarrollo',
              label: 'Clave',
              width: 'w-20',
            },
            {
              key: 'manzana',
              label: 'Manzana',
              width: 'w-20',
            },
            {
              key: 'nolote',
              label: 'Lote',
              width: 'w-20',
            },
            {
              key: 'preciolote',
              label: 'Precio',
              render: (row: Lote) => formatCurrency(row.preciolote),
            },
            {
              key: 'estatus',
              label: 'Estado',
              render: (row: Lote) => (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getLoteStatusColor(row.estatus)}`}>
                  {getLoteStatusLabel(row.estatus)}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row: Lote) => (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/lotes/${row.loteid}`, { state: { from: '/admin/lotes' } })}
                    className="inline-flex items-center gap-1"
                    title="Ver detalles"
                  >
                    <Eye size={16} />
                  </Button>
                  {canEditLotes && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditLote(row)}
                        className="inline-flex items-center gap-1"
                        title="Editar lote"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLoteEnEdicion(row)
                          setShowDeleteConfirm(true)
                        }}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        title="Eliminar lote"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          data={lotes}
          loading={loading}
        />

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
          <Button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            variant="outline"
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft size={18} />
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {totalItems === 0 ? 0 : currentPage} de {Math.ceil(totalItems / itemsPerPage)}
            {totalItems > 0 && ` (${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalItems)} de ${totalItems})`}
          </span>
          <Button
            onClick={() => setCurrentPage(Math.min(Math.ceil(totalItems / itemsPerPage), currentPage + 1))}
            disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
            variant="outline"
            className="inline-flex items-center gap-2"
          >
            Siguiente
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Modal for creating new lote */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Crear Nuevo Lote">
        <LoteForm onSubmit={handleCreateLote} isLoading={isSubmitting} />
      </Modal>

      {/* Modal for editing lote */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Lote">
        <LoteForm lote={loteEnEdicion} onSubmit={handleUpdateLote} isLoading={isSubmitting} />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Eliminar Lote">
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar el lote {loteEnEdicion?.nolote} de la manzana {loteEnEdicion?.manzana}? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-4 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteLote}
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6"
            >
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
