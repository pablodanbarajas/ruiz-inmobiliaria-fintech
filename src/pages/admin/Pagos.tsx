import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PagoForm } from '@/components/forms/PagoForm'
import type { PagoFormData } from '@/components/forms/PagoForm'
import { Eye, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import type { Pago, CorridaFinanciera, Venta, Cliente } from '@/types/database'
import { getPagoStatusLabel, getPagoStatusColor, formatCurrency, formatDate } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

interface PagoWithDetails extends Pago {
  corridafinanciera?: CorridaFinanciera & {
    venta?: Venta & {
      cliente?: Cliente
    }
  }
}

export const Pagos = () => {
  const navigate = useNavigate()
  const [pagos, setPagos] = useState<PagoWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    clienteId: '',
    fechaDesde: '',
    fechaHasta: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10
  const [prevFilters, setPrevFilters] = useState(filters)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchClientes = async () => {
      const all: Cliente[] = []
      const pageSize = 1000
      let page = 0
      let hasMore = true
      while (hasMore) {
        const { data } = await supabase
          .from('cliente')
          .select('clienteid, nombre, telefonocelular, telefono2')
          .order('nombre', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)
        const rows = (data || []) as Cliente[]
        all.push(...rows)
        hasMore = rows.length === pageSize
        page++
      }
      setClientes(all)
    }
    fetchClientes()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  useEffect(() => {
    const fetchPagos = async () => {
      try {
        setLoading(true)

        // First, fetch all pagos with minimal data to apply filters
        const { data: allPagos, error: errorAllPagos } = await supabase
          .from('pagos')
          .select('pagoid, fechapago, montopagado, estatus, corridafinancieraid', { count: 'estimated' })
          .order('fechapago', { ascending: false })

        if (errorAllPagos) throw errorAllPagos

        let filteredData = (allPagos || []) as any[]

        // Apply filters on the client
        if (filters.clienteId) {
          // Step 1: Get all ventas for this client
          const { data: ventasData } = await supabase
            .from('venta')
            .select('ventaid')
            .eq('clienteid', filters.clienteId)

          if (ventasData && ventasData.length > 0) {
            const ventaIds = ventasData.map((v: any) => v.ventaid)

            // Step 2: Get all corridafinanciera for those ventas
            const { data: corridasData } = await supabase
              .from('corridafinanciera')
              .select('corridafinancieraid')
              .in('ventaid', ventaIds)

            if (corridasData && corridasData.length > 0) {
              const corridaIds = corridasData.map((c: any) => c.corridafinancieraid)

              // Step 3: Get pagos for those corridafinanciera
              const { data: pagosFull } = await supabase
                .from('pagos')
                .select('pagoid, fechapago, montopagado, estatus, corridafinanciera(venta(ventaid, clienteid, cliente(nombre)))')
                .in('corridafinancieraid', corridaIds)
                .order('fechapago', { ascending: false })

              filteredData = (pagosFull || [])
            }
          } else {
            filteredData = []
          }
        } else {
          // If no client filter, fetch with relations for display
          const { data: pagosFull } = await supabase
            .from('pagos')
            .select('pagoid, fechapago, montopagado, estatus, corridafinanciera(venta(ventaid, clienteid, cliente(nombre), lote:lote(desarrolloid)))')
            .order('fechapago', { ascending: false })
            .limit(5000)

          filteredData = (pagosFull || [])
        }

        if (DEMO_DESARROLLOIDS.length > 0) {
          filteredData = filteredData.filter((p: any) => {
            const lote = p.corridafinanciera?.venta?.lote
            const devId = (Array.isArray(lote) ? lote[0] : lote)?.desarrolloid
            return DEMO_DESARROLLOIDS.includes(devId)
          })
        }

        if (filters.fechaDesde) {
          filteredData = filteredData.filter((p) => p.fechapago && p.fechapago >= filters.fechaDesde)
        }
        if (filters.fechaHasta) {
          filteredData = filteredData.filter((p) => p.fechapago && p.fechapago <= filters.fechaHasta)
        }

        setTotalItems(filteredData.length)
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        setPagos(filteredData.slice(startIndex, endIndex) as unknown as PagoWithDetails[])
      } catch (error) {
        console.error('Error fetching pagos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPagos()
  }, [filters, currentPage])

  const handleCreatePago = async (data: PagoFormData) => {
    try {
      setIsSubmitting(true)
      const { data: newPago, error } = await supabase
        .from('pagos')
        .insert({
          corridafinancieraid: data.corridafinancieraid,
          fechapago: data.fechapago,
          montopagado: data.montopagado,
          formapago: data.formapago,
          estatus: data.estatus,
          referencia: data.referencia,
          comentario: data.comentario,
        })
        .select()
        .single()

      if (error) throw error

      setShowCreateModal(false)
      navigate(`/admin/pagos/${newPago.pagoid}`)
    } catch (err: any) {
      console.error('Error creating pago:', err)
      alert(`Error al registrar el pago: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Tesorería</h1>
            <p className="text-[#9e9f92] mt-2">Registro de pagos realizados</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2"
            style={{ backgroundColor: '#eaae4c', color: '#000' }}
          >
            <Plus size={18} />
            Nuevo Pago
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Cliente
              </label>
              <SearchCombobox
                options={clientes.map((c): ComboOption => ({
                  value: String(c.clienteid),
                  label: c.nombre || 'Sin nombre',
                  sublabel: c.telefonocelular || c.telefono2 || undefined,
                }))}
                value={filters.clienteId}
                onChange={(v) => setFilters({ ...filters, clienteId: v })}
                placeholder="Buscar por nombre o teléfono..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Fecha Desde
              </label>
              <Input
                type="date"
                value={filters.fechaDesde}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, fechaDesde: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Fecha Hasta
              </label>
              <Input
                type="date"
                value={filters.fechaHasta}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, fechaHasta: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable<PagoWithDetails>
          columns={[
            {
              key: 'pagoid',
              label: 'Pago ID',
              width: 'w-20',
            },
            {
              key: 'cliente',
              label: 'Cliente',
              render: (row: PagoWithDetails) => row.corridafinanciera?.venta?.cliente?.nombre || '-',
            },
            {
              key: 'venta',
              label: 'Venta ID',
              render: (row: PagoWithDetails) => row.corridafinanciera?.venta?.ventaid || '-',
              width: 'w-24',
            },
            {
              key: 'fechapago',
              label: 'Fecha de Pago',
              render: (row: PagoWithDetails) => formatDate(row.fechapago),
            },
            {
              key: 'montopagado',
              label: 'Monto',
              render: (row: PagoWithDetails) => formatCurrency(row.montopagado),
            },
            {
              key: 'estatus',
              label: 'Estado',
              render: (row: PagoWithDetails) => (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPagoStatusColor(row.estatus)}`}>
                  {getPagoStatusLabel(row.estatus)}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row: PagoWithDetails) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/pagos/${row.pagoid}`)}
                  className="inline-flex items-center gap-1"
                >
                  <Eye size={16} />
                  Ver
                </Button>
              ),
            },
          ]}
          data={pagos}
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
    </AdminLayout>

    {/* ── Modal: Nuevo Pago ──────────────────────────────────── */}
    <Modal
      isOpen={showCreateModal}
      title="Nuevo Pago"
      onClose={() => !isSubmitting && setShowCreateModal(false)}
      size="xl"
    >
      <PagoForm onSubmit={handleCreatePago} isLoading={isSubmitting} />
    </Modal>
    </>
  )
}
