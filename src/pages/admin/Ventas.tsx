import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Venta, Cliente, Lote, Desarrollo } from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/helpers'

interface VentaWithDetails extends Venta {
  cliente?: Cliente
  lote?: Lote & { desarrollo?: Desarrollo }
}

export const Ventas = () => {
  const navigate = useNavigate()
  const [ventas, setVentas] = useState<VentaWithDetails[]>([])
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

  useEffect(() => {
    const fetchClientes = async () => {
      const { data } = await supabase
        .from('cliente')
        .select('*')
        .order('nombre', { ascending: true })
      if (data) setClientes(data)
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
    const fetchVentas = async () => {
      try {
        setLoading(true)
        let query = supabase
          .from('venta')
          .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
          .order('fecha', { ascending: false })

        if (filters.clienteId) {
          query = query.eq('clienteid', filters.clienteId)
        }

        const { data, error } = await query

        if (error) throw error

        let filteredData = (data || []) as VentaWithDetails[]

        if (filters.fechaDesde) {
          filteredData = filteredData.filter((v) => v.fecha && v.fecha >= filters.fechaDesde)
        }
        if (filters.fechaHasta) {
          filteredData = filteredData.filter((v) => v.fecha && v.fecha <= filters.fechaHasta)
        }

        setTotalItems(filteredData.length)
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        setVentas(filteredData.slice(startIndex, endIndex))
      } catch (error) {
        console.error('Error fetching ventas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchVentas()
  }, [filters])

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Ventas</h1>
          <p className="text-[#9e9f92] mt-2">Histórico de transacciones</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Cliente
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={filters.clienteId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, clienteId: e.target.value })}
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c.clienteid} value={c.clienteid}>
                    {c.nombre}
                  </option>
                ))}
              </select>
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
        <DataTable<VentaWithDetails>
          columns={[
            {
              key: 'ventaid',
              label: 'Venta ID',
              width: 'w-20',
            },
            {
              key: 'cliente',
              label: 'Cliente',
              render: (row: VentaWithDetails) => row.cliente?.nombre || '-',
            },
            {
              key: 'desarrollo',
              label: 'Desarrollo',
              render: (row: VentaWithDetails) => row.lote?.desarrollo?.nombre || '-',
            },
            {
              key: 'lote',
              label: 'Lote',
              render: (row: VentaWithDetails) => `${row.lote?.manzana} - ${row.lote?.nolote}`,
            },
            {
              key: 'fecha',
              label: 'Fecha',
              render: (row: VentaWithDetails) => formatDate(row.fecha),
            },
            {
              key: 'preciolote',
              label: 'Precio',
              render: (row: VentaWithDetails) => formatCurrency(row.preciolote),
            },
            {
              key: 'enganche',
              label: 'Enganche',
              render: (row: VentaWithDetails) => formatCurrency(row.enganche),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row: VentaWithDetails) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/ventas/${row.ventaid}`)}
                  className="inline-flex items-center gap-1"
                >
                  <Eye size={16} />
                  Ver
                </Button>
              ),
            },
          ]}
          data={ventas}
          loading={loading}
        />

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
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
  )
}
