import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached, invalidateCache } from '@/lib/queryCache'
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
    desarrolloId: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10
  const [prevFilters, setPrevFilters] = useState(filters)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [showCreateModal, setShowCreateModal] = useState(() => searchParams.get('new') === 'true')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowCreateModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const fetchFilterOptions = async () => {
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
      const { data, error } = await supabase
        .from('desarrollo')
        .select('*')
        .order('nombre', { ascending: true })
      if (error) {
        console.error('Error fetching desarrollos:', error)
        return
      }
      setDesarrollos(
        ((data || []).filter((desarrollo) =>
          DEMO_DESARROLLOIDS.length === 0 ||
          DEMO_DESARROLLOIDS.includes(desarrollo.desarrolloid)
        )) as Desarrollo[]
      )
    }
    fetchFilterOptions()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  useEffect(() => {
    let ignore = false

    const fetchVentas = async () => {
      const cacheKey = `ventas:${JSON.stringify(filters)}:${currentPage}`
      const cached = getCached<{ items: VentaWithDetails[]; total: number }>(cacheKey)
      if (cached) { setVentas(cached.items); setTotalItems(cached.total); setLoading(false); return }
      try {
        setLoading(true)
        const desarrolloIds = DEMO_DESARROLLOIDS.filter(
          (id) => !filters.desarrolloId || id === Number(filters.desarrolloId)
        )
        const startIndex = (currentPage - 1) * itemsPerPage

        // Filtered and paged on the server: the API returns at most 1000 rows per request.
        let query = supabase
          .from('venta')
          .select('*, cliente:cliente(*), lote:lote!inner(*, desarrollo:desarrollo(*))', { count: 'exact' })
          .in('lote.desarrolloid', desarrolloIds)

        if (filters.clienteId) {
          query = query.eq('clienteid', filters.clienteId)
        }
        if (filters.fechaDesde) {
          query = query.gte('fecha', filters.fechaDesde)
        }
        if (filters.fechaHasta) {
          query = query.lte('fecha', `${filters.fechaHasta}T23:59:59.999`)
        }

        const { data, error, count } = await query
          .order('fecha', { ascending: false })
          .order('ventaid', { ascending: false })
          .range(startIndex, startIndex + itemsPerPage - 1)

        if (ignore) return
        if (error) throw error

        const page = (data || []) as VentaWithDetails[]
        const total = count ?? 0
        setTotalItems(total)
        setCached(cacheKey, { items: page, total })
        setVentas(page)
      } catch (error) {
        console.error('Error fetching ventas:', error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchVentas()
    return () => { ignore = true }
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
      const usuarioid = null // FK fk_venta_usuario references legacy usuario table, not auth.users

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
      invalidateCache('lotes:')

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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#63696c]">Gestión comercial</p>
            <h1 className="text-3xl md:text-4xl font-bold text-[#142127]" style={{ fontFamily: 'var(--font-display)' }}>Ventas</h1>
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
        <div className="bg-white rounded-[20px] border border-[#e0e5e7] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <DataTable<VentaWithDetails>
          emptyMessage="No se encontraron ventas con los filtros aplicados"
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
