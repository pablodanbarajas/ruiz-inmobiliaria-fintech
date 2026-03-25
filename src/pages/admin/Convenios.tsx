import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/DataTable'
import { ConvenioForm } from '@/components/forms/ConvenioForm'
import type { ConvenioFormData } from '@/components/forms/ConvenioForm'
import { ChevronLeft, ChevronRight, Eye, Plus } from 'lucide-react'
import type { Convenio, Venta, Cliente, Lote } from '@/types/database'
import { formatDate, getConvenioStatusLabel, getConvenioStatusColor } from '@/utils/helpers'

interface ConvenioWithDetails extends Convenio {
  venta?: Venta & { cliente?: Cliente; lote?: Lote }
}

export const Convenios = () => {
  const navigate = useNavigate()
  const [convenios, setConvenios] = useState<ConvenioWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10
  const [filters, setFilters] = useState({ clienteNombre: '', estatus: '' })
  const [prevFilters, setPrevFilters] = useState(filters)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset page on filter change
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  const fetchConvenios = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('convenios')
        .select('*, venta:venta(ventaid, estatus, cliente:cliente(clienteid, nombre), lote:lote(manzana, nolote, clavelote))')
        .order('fecha', { ascending: false })

      if (error) throw error

      let list = (data || []) as ConvenioWithDetails[]

      if (filters.clienteNombre) {
        const term = filters.clienteNombre.toLowerCase()
        list = list.filter((c) =>
          c.venta?.cliente?.nombre?.toLowerCase().includes(term)
        )
      }
      if (filters.estatus) {
        list = list.filter((c) => c.estatus === filters.estatus)
      }

      setTotalItems(list.length)
      const start = (currentPage - 1) * itemsPerPage
      setConvenios(list.slice(start, start + itemsPerPage))
    } catch (err) {
      console.error('Error fetching convenios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConvenios() }, [filters, currentPage])

  const handleCreate = async (data: ConvenioFormData) => {
    try {
      setIsSubmitting(true)
      const { error } = await supabase.from('convenios').insert({
        ventaid: data.ventaid,
        clienteid: data.clienteid,
        fecha: data.fecha,
        motivo: data.motivo,
        descripcion: data.descripcion,
        meses_atraso: data.meses_atraso,
        recargo_original: data.recargo_original,
        recargo_acordado: data.recargo_acordado,
        estatus: data.estatus,
        comentarios: data.comentarios,
      })
      if (error) throw error
      setShowCreateModal(false)
      fetchConvenios()
    } catch (err: any) {
      alert(`Error al registrar convenio: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Convenios
            </h1>
            <p className="text-[#9e9f92] mt-2">Acuerdos de pago y reestructuraciones</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-2 px-6 inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Nuevo Convenio
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Cliente</label>
              <Input
                placeholder="Buscar por nombre de cliente..."
                value={filters.clienteNombre}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters({ ...filters, clienteNombre: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Estado</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                value={filters.estatus}
                onChange={(e) => setFilters({ ...filters, estatus: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="V">Vigente</option>
                <option value="C">Cumplido</option>
                <option value="X">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <DataTable<ConvenioWithDetails>
          columns={[
            {
              key: 'convenioid',
              label: 'ID',
              width: 'w-16',
              render: (row) => <span className="font-semibold text-gray-700">#{row.convenioid}</span>,
            },
            {
              key: 'fecha',
              label: 'Fecha',
              render: (row) => formatDate(row.fecha),
            },
            {
              key: 'cliente',
              label: 'Cliente',
              render: (row) => (
                <button
                  className="text-blue-600 hover:underline text-left"
                  onClick={() => navigate(`/admin/clientes/${row.venta?.cliente?.clienteid}`)}
                >
                  {row.venta?.cliente?.nombre ?? '—'}
                </button>
              ),
            },
            {
              key: 'venta',
              label: 'Venta',
              render: (row) => (
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => navigate(`/admin/ventas/${row.ventaid}`)}
                >
                  #{row.ventaid}
                </button>
              ),
            },
            {
              key: 'lote',
              label: 'Lote',
              render: (row) =>
                row.venta?.lote
                  ? `Mza ${row.venta.lote.manzana ?? '-'} / ${row.venta.lote.nolote ?? '-'}`
                  : '—',
            },
            {
              key: 'meses_atraso',
              label: 'Pagos en atraso',
              render: (row) => (
                <span className={row.meses_atraso && row.meses_atraso > 0 ? 'text-orange-600 font-semibold' : ''}>
                  {row.meses_atraso ?? 0}
                </span>
              ),
            },
            {
              key: 'motivo',
              label: 'Motivo',
              render: (row) => <span className="text-sm text-gray-700">{row.motivo ?? '—'}</span>,
            },
            {
              key: 'estatus',
              label: 'Estado',
              render: (row) => (
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getConvenioStatusColor(row.estatus)}`}>
                  {getConvenioStatusLabel(row.estatus)}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/convenios/${row.convenioid}`)}
                  className="inline-flex items-center gap-1"
                  title="Ver detalle"
                >
                  <Eye size={16} />
                </Button>
              ),
            },
          ]}
          data={convenios}
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
            <ChevronLeft size={18} /> Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {totalPages === 0 ? 0 : currentPage} de {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            variant="outline"
            className="inline-flex items-center gap-2"
          >
            Siguiente <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Modal: Nuevo convenio */}
      <Modal
        isOpen={showCreateModal}
        title="Nuevo Convenio"
        onClose={() => !isSubmitting && setShowCreateModal(false)}
        size="xl"
      >
        <ConvenioForm onSubmit={handleCreate} isLoading={isSubmitting} />
      </Modal>
    </AdminLayout>
  )
}
