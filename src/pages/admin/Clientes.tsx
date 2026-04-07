import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ClienteForm } from '@/components/forms/ClienteForm'
import { Eye, Trash2, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react'
import type { Cliente } from '@/types/database'
import { getStatusLabel } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { useAuth } from '@/context/AuthContext'

export const Clientes = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [allClientsCache, setAllClientsCache] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10
  const [filters, setFilters] = useState({
    nombre: '',
    email: '',
    rfc: '',
  })
  const [prevFilters, setPrevFilters] = useState(filters)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null)
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null)

  // Reset to page 1 when filters change
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  // Fetch all clientes once on mount
  useEffect(() => {
    const fetchAllClientes = async () => {
      try {
        setLoading(true)
        
        // Fetch all clientes in chunks (Supabase default limit is 1000)
        let allData: Cliente[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from('cliente')
            .select('*')
            .order('nombre', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1)

          if (error) {
            console.error('Error fetching clientes:', error)
            throw error
          }

          if (!data || data.length === 0) {
            hasMore = false
          } else {
            allData = [...allData, ...data]
            page++
            if (data.length < pageSize) {
              hasMore = false
            }
          }
        }

        setAllClientsCache(allData)

        // In demo mode, restrict to clients that have ventas in the demo desarrollo
        if (DEMO_DESARROLLOIDS !== null && allData.length > 0) {
          const { data: lotesDemo } = await supabase
            .from('lote')
            .select('loteid')
            .in('desarrolloid', DEMO_DESARROLLOIDS)
          const loteIds = (lotesDemo || []).map((l: any) => l.loteid)
          if (loteIds.length > 0) {
            const { data: ventasDemo } = await supabase
              .from('venta')
              .select('clienteid')
              .in('loteid', loteIds)
            const demoClienteIds = new Set(
              (ventasDemo || []).map((v: any) => v.clienteid).filter(Boolean)
            )
            setAllClientsCache(allData.filter((c) => demoClienteIds.has(c.clienteid)))
          } else {
            setAllClientsCache([])
          }
        }
        console.error('Error fetching clientes:', error)
        setAllClientsCache([])
      } finally {
        setLoading(false)
      }
    }

    fetchAllClientes()
  }, [])

  // Filter and paginate from cache
  useEffect(() => {
    let filteredData = [...allClientsCache]

    if (filters.nombre) {
      const searchNombre = filters.nombre.toLowerCase().trim()
      filteredData = filteredData.filter((c) =>
        c.nombre?.toLowerCase().trim().includes(searchNombre)
      )
    }
    if (filters.email) {
      const searchEmail = filters.email.toLowerCase().trim()
      filteredData = filteredData.filter((c) =>
        c.email?.toLowerCase().trim().includes(searchEmail)
      )
    }
    if (filters.rfc) {
      const searchRfc = filters.rfc.toLowerCase().trim()
      filteredData = filteredData.filter((c) =>
        c.rfc?.toLowerCase().trim().includes(searchRfc)
      )
    }

    setTotalItems(filteredData.length)
    
    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedData = filteredData.slice(startIndex, endIndex)

    setClientes(paginatedData)
  }, [filters, currentPage, allClientsCache])

  const handleCreateCliente = async (formData: any) => {
    try {
      setIsSubmitting(true)
      const { data, error } = await supabase.from('cliente').insert([formData]).select()

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      // Add new cliente to cache
      if (data && data.length > 0) {
        setAllClientsCache([...allClientsCache, data[0]])
      }

      setShowModal(false)
      setCurrentPage(1)
    } catch (err) {
      console.error('Error creating cliente:', err)
      alert('Error al crear el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCliente = async (formData: any) => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase
        .from('cliente')
        .update(formData)
        .eq('clienteid', clienteToEdit?.clienteid)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      // Update in cache
      const updatedCliente = { ...clienteToEdit, ...formData }
      setAllClientsCache(allClientsCache.map(c => c.clienteid === clienteToEdit?.clienteid ? updatedCliente as Cliente : c))
      setClientes(clientes.map(c => c.clienteid === clienteToEdit?.clienteid ? updatedCliente as Cliente : c))

      setClienteToEdit(null)
      setShowModal(false)
    } catch (err) {
      console.error('Error updating cliente:', err)
      alert('Error al actualizar el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCliente = async () => {
    try {
      setIsSubmitting(true)

      // Check if there are any ventas associated
      const { data: ventasCount } = await supabase
        .from('venta')
        .select('ventaid', { count: 'exact' })
        .eq('clienteid', clienteToDelete?.clienteid)

      if (ventasCount && ventasCount.length > 0) {
        alert('No se puede eliminar un cliente que tiene ventas asociadas. Cambia su estado a inactivo en su lugar.')
        setShowDeleteConfirm(false)
        setIsSubmitting(false)
        return
      }

      const { error } = await supabase
        .from('cliente')
        .delete()
        .eq('clienteid', clienteToDelete?.clienteid)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      // Remove from cache
      setAllClientsCache(allClientsCache.filter(c => c.clienteid !== clienteToDelete?.clienteid))

      setShowDeleteConfirm(false)
      setClienteToDelete(null)
      setCurrentPage(1)
    } catch (err) {
      console.error('Error deleting cliente:', err)
      alert('Error al eliminar el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Clientes</h1>
            <p className="text-[#9e9f92] mt-2">Listado de compradores</p>
          </div>
          <Button
            onClick={() => {
              setClienteToEdit(null)
              setShowModal(true)
            }}
            className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-2 px-6"
          >
            + Nuevo Cliente
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Nombre
              </label>
              <Input
                placeholder="Buscar por nombre..."
                value={filters.nombre}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Email
              </label>
              <Input
                placeholder="Buscar por email..."
                value={filters.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                RFC
              </label>
              <Input
                placeholder="Buscar por RFC..."
                value={filters.rfc}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, rfc: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable<Cliente>
          columns={[
            {
              key: 'nombre',
              label: 'Nombre',
            },
            {
              key: 'email',
              label: 'Email',
            },
            {
              key: 'rfc',
              label: 'RFC',
              width: 'w-32',
            },
            {
              key: 'telefonocelular',
              label: 'Teléfono',
            },
            {
              key: 'estatus',
              label: 'Estado',
              render: (row: Cliente) => (
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
              key: 'actions',
              label: 'Acciones',
              render: (row: Cliente) => (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/clientes/${row.clienteid}`)}
                    className="inline-flex items-center gap-1"
                    title="Ver detalles"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setClienteToEdit(row)
                      setShowModal(true)
                    }}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    title="Editar cliente"
                  >
                    <Edit2 size={16} />
                  </Button>
                  {role === 'admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setClienteToDelete(row)
                        setShowDeleteConfirm(true)
                      }}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      title="Eliminar cliente"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          data={clientes}
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

      {/* Modal for creating/editing cliente */}
      <Modal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false)
          setClienteToEdit(null)
        }} 
        title={clienteToEdit ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
      >
        <ClienteForm 
          onSubmit={clienteToEdit ? handleUpdateCliente : handleCreateCliente} 
          isLoading={isSubmitting}
          cliente={clienteToEdit || undefined}
        />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Eliminar Cliente">
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar a {clienteToDelete?.nombre}? Esta acción no se puede deshacer.
          </p>
          <p className="text-sm text-gray-500">
            Nota: Si el cliente tiene ventas asociadas, no podrá ser eliminado. En su lugar, cambia su estado a "Inactivo".
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
              onClick={handleDeleteCliente}
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
