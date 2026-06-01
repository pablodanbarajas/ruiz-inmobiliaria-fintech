import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { VentaForm } from '@/components/forms/VentaForm'
import type { VentaFormData } from '@/components/forms/VentaForm'
import { Eye, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import type { Venta, Cliente, Lote, Desarrollo } from '@/types/database'
import { formatCurrency, formatDate, getVentaStatusLabel, getVentaStatusColor } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

interface VentaWithDetails extends Venta {
  cliente?: Cliente
  lote?: Lote & { desarrollo?: Desarrollo }
}

export const Ventas = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [ventas, setVentas] = useState<VentaWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = usePersistedFilters('ventasFilters', {
    clienteId: '',
    fechaDesde: '',
    fechaHasta: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10
  const [prevFilters, setPrevFilters] = useState(filters)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [showCreateModal, setShowCreateModal] = useState(() => searchParams.get('new') === 'true')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowCreateModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

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

        if (DEMO_DESARROLLOIDS.length > 0) {
          filteredData = filteredData.filter(
            (v) => DEMO_DESARROLLOIDS.includes(v.lote?.desarrolloid as number)
          )
        }

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
  }, [filters, currentPage])

  // ── Business logic helpers ────────────────────────────────────────────────

  const generateCorridaFinanciera = (
    ventaid: number,
    data: Pick<
      VentaFormData,
      'preciolote' | 'enganche' | 'plazo' | 'fechaenganche' | 'fechaprimeramensualidad' | 'mensualidad'
    >
  ) => {
    const saldoInicial = data.preciolote - data.enganche
    const mensualidadMonto = data.mensualidad
    const records: {
      ventaid: number
      nopago: number
      fecha: string
      mensualidad: number
      saldo: number
    }[] = []

    // Record 0: Enganche
    records.push({
      ventaid,
      nopago: 0,
      fecha: data.fechaenganche,
      mensualidad: data.enganche,
      saldo: saldoInicial,
    })

    // Records 1..plazo: Mensualidades
    // T12:00:00 avoids timezone-day-shift issues
    const fechaPrimera = new Date(data.fechaprimeramensualidad + 'T12:00:00')
    for (let i = 1; i <= data.plazo; i++) {
      const fechaPago = new Date(fechaPrimera)
      fechaPago.setMonth(fechaPago.getMonth() + (i - 1))
      const saldoRestante =
        i === data.plazo
          ? 0
          : parseFloat((saldoInicial - mensualidadMonto * i).toFixed(2))
      records.push({
        ventaid,
        nopago: i,
        fecha: fechaPago.toISOString().split('T')[0],
        mensualidad: mensualidadMonto,
        saldo: Math.max(0, saldoRestante),
      })
    }
    return records
  }

  const handleCreateVenta = async (data: VentaFormData) => {
    try {
      setIsSubmitting(true)

      // 1. Atomic lock: update lote D→V only if still available.
      //    This is a single DB operation — avoids race condition between two users.
      const { data: authData } = await supabase.auth.getUser()
      const usuarioid = authData.user?.id ?? null

      const { data: lockedLote, error: lockError } = await supabase
        .from('lote')
        .update({ estatus: 'V' })
        .eq('loteid', data.loteid)
        .eq('estatus', 'D')   // Only succeeds if the lote is still available
        .select()

      if (lockError) throw new Error(lockError.message)
      if (!lockedLote || lockedLote.length === 0) {
        alert('El lote seleccionado ya no está disponible. Fue reservado por otro usuario.')
        return
      }

      // 2. Insert venta
      const { data: ventaData, error: ventaError } = await supabase
        .from('venta')
        .insert([
          {
            loteid: data.loteid,
            clienteid: data.clienteid,
            fecha: data.fecha,
            fechacontrato: data.fechacontrato,
            usuarioid,
            preciolote: data.preciolote,
            enganche: data.enganche,
            porcenganche: data.porcenganche,
            fechaenganche: data.fechaenganche,
            plazo: data.plazo,
            fechaprimeramensualidad: data.fechaprimeramensualidad,
            mensualidad: data.mensualidad,
            estatus: 'A',
            comentarios: data.comentarios ?? null,
            plazoenganche: data.plazoenganche ?? 1,
            vendedor: data.vendedor ?? null,
          },
        ])
        .select()
        .single()

      if (ventaError) {
        // Rollback lote to disponible since venta failed
        await supabase.from('lote').update({ estatus: 'D' }).eq('loteid', data.loteid)
        throw new Error(`Error al insertar venta: ${ventaError.message}`)
      }
      const ventaid: number = ventaData.ventaid

      // Lote is already 'V' from the atomic lock step — skip the separate update
      const corridaRecords = generateCorridaFinanciera(ventaid, data)
      const { error: corridaError } = await supabase
        .from('corridafinanciera')
        .insert(corridaRecords)

      if (corridaError) {
        // Rollback venta + lote
        await supabase.from('venta').delete().eq('ventaid', ventaid)
        await supabase.from('lote').update({ estatus: 'D' }).eq('loteid', data.loteid)
        throw new Error(`Error al generar corrida financiera: ${corridaError.message}`)
      }

      setShowCreateModal(false)
      navigate(`/admin/ventas/${ventaid}`, { state: { from: '/admin/ventas' } })
    } catch (err: any) {
      console.error('Error creating venta:', err)
      alert(`Error al registrar la venta: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Ventas</h1>
            <p className="text-[#9e9f92] mt-2">Histórico de transacciones</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Nueva Venta
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
              key: 'estatus',
              label: 'Estatus',
              render: (row: VentaWithDetails) => (
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                    getVentaStatusColor(row.estatus)
                  }`}
                >
                  {getVentaStatusLabel(row.estatus)}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row: VentaWithDetails) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/ventas/${row.ventaid}`, { state: { from: '/admin/ventas' } })}
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

      {/* ── Modal: Nueva Venta ─────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        title="Nueva Venta"
        onClose={() => !isSubmitting && setShowCreateModal(false)}
        size="xl"
      >
        <VentaForm onSubmit={handleCreateVenta} isLoading={isSubmitting} />
      </Modal>
    </AdminLayout>
  )
}
