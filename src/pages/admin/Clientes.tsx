import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached } from '@/lib/queryCache'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ClienteForm } from '@/components/forms/ClienteForm'
import { Eye, Trash2, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react'
import type { Cliente, Desarrollo } from '@/types/database'
import { getStatusLabel } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { useAuth } from '@/context/AuthContext'

export const Clientes = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { role } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [allClientsCache, setAllClientsCache] = useState<Cliente[]>([])
  const [allClientsSearchCache, setAllClientsSearchCache] = useState<Cliente[]>([])
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [clientDevelopmentIds, setClientDevelopmentIds] = useState<Record<number, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10
  const [filters, setFilters] = usePersistedFilters('clientesFilters', {
    nombre: '',
    email: '',
    rfc: '',
    desarrolloId: '',
  })
  const [prevFilters, setPrevFilters] = useState(filters)
  const [showModal, setShowModal] = useState(() => searchParams.get('new') === 'true')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])
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
      const CACHE_KEY = 'clientes:all:v5'
      const cached = getCached<{
        all: Cliente[]
        visible: Cliente[]
        desarrollos: Desarrollo[]
        clientDevelopmentIds: Record<number, number[]>
      }>(CACHE_KEY)
      if (cached) {
        setAllClientsSearchCache(cached.all)
        setAllClientsCache(cached.visible)
        setDesarrollos(cached.desarrollos)
        setClientDevelopmentIds(cached.clientDevelopmentIds)
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        
        const { data: adminRoleRows, error: adminRolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', [
            'admin',
            'finanzas',
            'vendedor',
            'vendedor_externo',
            'contratos',
            'cobranza_caja',
            'desarrollo_ri',
          ])
        if (adminRolesError) {
          console.error('Error obteniendo usuarios administrativos:', adminRolesError)
          throw adminRolesError
        }
        const adminUserIds = new Set((adminRoleRows ?? []).map((row) => row.user_id))

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

        const [{ data: developmentRows, error: developmentsError }, { data: salesRows, error: salesError }] =
          await Promise.all([
            supabase.from('desarrollo').select('*').order('nombre', { ascending: true }),
            supabase.from('venta').select('clienteid, lote:lote(desarrolloid)'),
          ])
        if (developmentsError) throw developmentsError
        if (salesError) throw salesError

        const developmentData = (developmentRows || []) as Desarrollo[]
        const developmentIdsByClient: Record<number, number[]> = {}
        ;(salesRows || []).forEach((sale: any) => {
          const desarrolloId = sale.lote?.desarrolloid
          if (!sale.clienteid || !desarrolloId) return
          const current = developmentIdsByClient[sale.clienteid] || []
          if (!current.includes(desarrolloId)) current.push(desarrolloId)
          developmentIdsByClient[sale.clienteid] = current
        })

        const clientData = allData.filter((cliente) => !cliente.user_id || !adminUserIds.has(cliente.user_id))
        let finalCache = clientData

        // In demo mode, restrict to clients that have ventas in the demo desarrollo
        if (DEMO_DESARROLLOIDS.length > 0 && clientData.length > 0) {
          // Clientes con al menos una venta (en cualquier desarrollo)
          const { data: ventasAll } = await supabase
            .from('venta')
            .select('clienteid')
          const clientesConAlgunaVenta = new Set(
            (ventasAll || []).map((v: any) => v.clienteid).filter(Boolean)
          )

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
            // Mostrar:
            // 1) clientes con ventas en desarrollos demo
            // 2) clientes sin ninguna venta (recién creados, por ejemplo)
            finalCache = clientData.filter(
              (c) => demoClienteIds.has(c.clienteid) || !clientesConAlgunaVenta.has(c.clienteid)
            )
          } else {
            // Si no hay lotes demo configurados, mostrar solo clientes sin ventas
            finalCache = clientData.filter((c) => !clientesConAlgunaVenta.has(c.clienteid))
          }
        }

        setAllClientsCache(finalCache)
        setAllClientsSearchCache(finalCache)
        setDesarrollos(developmentData)
        setClientDevelopmentIds(developmentIdsByClient)
        setCached(CACHE_KEY, {
          all: finalCache,
          visible: finalCache,
          desarrollos: developmentData,
          clientDevelopmentIds: developmentIdsByClient,
        })
      } catch (error) {
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
    const hasSearchFilter = Boolean(
      filters.nombre.trim() || filters.email.trim() || filters.rfc.trim()
    )
    let filteredData = [...(hasSearchFilter ? allClientsSearchCache : allClientsCache)]

    if (filters.desarrolloId) {
      const desarrolloId = Number(filters.desarrolloId)
      filteredData = filteredData.filter((cliente) =>
        clientDevelopmentIds[cliente.clienteid]?.includes(desarrolloId)
      )
    }

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
  }, [filters, currentPage, allClientsCache, allClientsSearchCache, clientDevelopmentIds])

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
        setAllClientsSearchCache([...allClientsSearchCache, data[0]])
        setCached('clientes:all:v4', {
          all: [...allClientsSearchCache, data[0]],
          visible: [...allClientsCache, data[0]],
        })
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
      setAllClientsSearchCache(allClientsSearchCache.map(c => c.clienteid === clienteToEdit?.clienteid ? updatedCliente as Cliente : c))
      setCached('clientes:all:v4', {
        all: allClientsSearchCache.map(c => c.clienteid === clienteToEdit?.clienteid ? updatedCliente as Cliente : c),
        visible: allClientsCache.map(c => c.clienteid === clienteToEdit?.clienteid ? updatedCliente as Cliente : c),
      })
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
      setAllClientsSearchCache(allClientsSearchCache.filter(c => c.clienteid !== clienteToDelete?.clienteid))
      setCached('clientes:all:v4', {
        all: allClientsSearchCache.filter(c => c.clienteid !== clienteToDelete?.clienteid),
        visible: allClientsCache.filter(c => c.clienteid !== clienteToDelete?.clienteid),
      })

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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#63696c]">Gestión comercial</p>
            <h1 className="text-3xl md:text-4xl font-bold text-[#142127]" style={{ fontFamily: 'var(--font-display)' }}>Clientes</h1>
            <p className="text-[#9e9f92] mt-2">Listado de compradores</p>
          </div>
          <Button
            onClick={() => {
              setClienteToEdit(null)
              setShowModal(true)
            }}
            className="bg-[#142127] hover:bg-[#343c40] text-white font-semibold py-2 px-6 rounded-full"
          >
            + Nuevo Cliente
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-[20px] border border-[#e0e5e7] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Desarrollo
              </label>
              <select
                value={filters.desarrolloId}
                onChange={(e) => setFilters({ ...filters, desarrolloId: e.target.value })}
                className="w-full h-10 rounded-lg border border-[#d9e0e2] bg-white px-3 text-sm text-[#142127] focus:outline-none focus:ring-2 focus:ring-[#9e9f92]"
              >
                <option value="">Todos los desarrollos</option>
                {desarrollos.map((desarrollo) => (
                  <option key={desarrollo.desarrolloid} value={desarrollo.desarrolloid}>
                    {desarrollo.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable<Cliente>
          emptyMessage="No se encontraron clientes con los filtros aplicados"
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
