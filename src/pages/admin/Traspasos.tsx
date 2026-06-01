import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Input } from '@/components/ui/Input'
import { ChevronLeft, ChevronRight, ArrowLeftRight, ExternalLink, Plus, X } from 'lucide-react'
import type { Traspaso } from '@/types/database'
import { formatDate, formatDateTime } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { SearchCombobox, type ComboOption } from '@/components/ui/SearchCombobox'

interface TraspasoWithDetails extends Traspaso {
  cliente_anterior?: { nombre: string | null }
  cliente_nuevo?: { nombre: string | null }
  venta?: {
    ventaid: number
    lote?: { manzana: string | null; nolote: string | null; clavelote: string | null; desarrolloid: number | null }
  } | null
}

const PAGE_SIZE = 15

export const Traspasos = () => {
  const navigate = useNavigate()
  const [traspasos, setTraspasos] = useState<TraspasoWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [filters, setFilters] = usePersistedFilters('traspasosFilters', {
    clienteNombre: '',
    fechaDesde: '',
    fechaHasta: '',
  })
  const [prevFilters, setPrevFilters] = useState(filters)

  // ── Nuevo Traspaso modal state ──────────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ventaOptions, setVentaOptions] = useState<ComboOption[]>([])
  const [clienteOptions, setClienteOptions] = useState<ComboOption[]>([])
  const [selectedVentaId, setSelectedVentaId] = useState('')
  const [selectedVenta, setSelectedVenta] = useState<{ ventaid: number; clienteid: number; clienteNombre: string } | null>(null)
  const [nuevoClienteId, setNuevoClienteId] = useState('')
  const [traspasoFecha, setTraspasoFecha] = useState('')
  const [traspasoNotas, setTraspasoNotas] = useState('')
  const [modalError, setModalError] = useState('')

  // Reset to page 1 on filter change
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  useEffect(() => {
    const fetchTraspasos = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('traspasos')
          .select(`
            *,
            cliente_anterior:cliente!clienteid_anterior(nombre),
            cliente_nuevo:cliente!clienteid_nuevo(nombre),
            venta:venta(ventaid, lote:lote(manzana, nolote, clavelote, desarrolloid))
          `)
          .order('created_at', { ascending: false })

        if (error) throw error

        let list = (data || []) as TraspasoWithDetails[]

        if (DEMO_DESARROLLOIDS.length > 0) {
          list = list.filter((t) => {
            const lote = t.venta?.lote
            const devId = (Array.isArray(lote) ? lote[0] : lote as any)?.desarrolloid
            return DEMO_DESARROLLOIDS.includes(devId)
          })
        }

        if (filters.clienteNombre) {
          const term = filters.clienteNombre.toLowerCase()
          list = list.filter(
            (t) =>
              t.cliente_anterior?.nombre?.toLowerCase().includes(term) ||
              t.cliente_nuevo?.nombre?.toLowerCase().includes(term)
          )
        }
        if (filters.fechaDesde) {
          list = list.filter((t) => t.fecha >= filters.fechaDesde)
        }
        if (filters.fechaHasta) {
          list = list.filter((t) => t.fecha <= filters.fechaHasta)
        }

        setTotalItems(list.length)
        const start = (currentPage - 1) * PAGE_SIZE
        setTraspasos(list.slice(start, start + PAGE_SIZE))
      } catch (err) {
        console.error('Error fetching traspasos:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTraspasos()
  }, [filters, currentPage])

  const totalPages = Math.ceil(totalItems / PAGE_SIZE)

  // ── Nuevo Traspaso helpers ──────────────────────────────────────
  const openNuevoTraspaso = async () => {
    setSelectedVentaId('')
    setSelectedVenta(null)
    setNuevoClienteId('')
    setTraspasoFecha(new Date().toISOString().split('T')[0])
    setTraspasoNotas('')
    setModalError('')
    setShowModal(true)

    // Load active ventas
    if (ventaOptions.length === 0) {
      const { data } = await supabase
        .from('venta')
        .select('ventaid, clienteid, estatus, cliente:cliente(nombre), lote:lote(manzana, nolote, clavelote, desarrolloid)')
        .eq('estatus', 'A')
        .order('ventaid', { ascending: false })
      const list = (data || []).filter((v: any) => {
        const lote = Array.isArray(v.lote) ? v.lote[0] : v.lote
        return DEMO_DESARROLLOIDS.length === 0 || DEMO_DESARROLLOIDS.includes(lote?.desarrolloid)
      })
      setVentaOptions(
        list.map((v: any) => {
          const lote = Array.isArray(v.lote) ? v.lote[0] : v.lote
          const loteLabel = lote ? `Mza ${lote.manzana} – Lote ${lote.nolote}${lote.clavelote ? ` (${lote.clavelote})` : ''}` : ''
          const clienteArr = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente
          return {
            value: v.ventaid.toString(),
            label: `Venta #${v.ventaid}`,
            sublabel: [loteLabel, clienteArr?.nombre].filter(Boolean).join(' · '),
          }
        })
      )
    }

    // Load all clients
    if (clienteOptions.length === 0) {
      let all: { clienteid: number; nombre: string | null; email: string | null }[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      while (hasMore) {
        const { data } = await supabase
          .from('cliente')
          .select('clienteid, nombre, email')
          .order('nombre')
          .range(page * pageSize, page * pageSize + pageSize - 1)
        all = all.concat(data || [])
        hasMore = (data?.length ?? 0) === pageSize
        page++
      }
      setClienteOptions(
        all.map((c) => ({
          value: c.clienteid.toString(),
          label: c.nombre ?? `Cliente #${c.clienteid}`,
          sublabel: c.email ?? undefined,
        }))
      )
    }
  }

  const handleVentaSelect = async (ventaId: string) => {
    setSelectedVentaId(ventaId)
    setNuevoClienteId('')
    setModalError('')
    if (!ventaId) { setSelectedVenta(null); return }
    const { data } = await supabase
      .from('venta')
      .select('ventaid, clienteid, cliente:cliente(nombre)')
      .eq('ventaid', parseInt(ventaId))
      .single()
    if (data) {
      const clienteArr = Array.isArray((data as any).cliente) ? (data as any).cliente[0] : (data as any).cliente
      setSelectedVenta({
        ventaid: (data as any).ventaid,
        clienteid: (data as any).clienteid,
        clienteNombre: clienteArr?.nombre ?? `Cliente #${(data as any).clienteid}`,
      })
    }
  }

  const handleSubmitTraspaso = async () => {
    if (!selectedVenta || !nuevoClienteId) {
      setModalError('Selecciona una venta y un nuevo titular.')
      return
    }
    if (parseInt(nuevoClienteId) === selectedVenta.clienteid) {
      setModalError('El nuevo titular debe ser diferente al titular actual.')
      return
    }
    try {
      setIsSubmitting(true)
      setModalError('')
      const { data: authData } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('traspasos').insert({
        ventaid: selectedVenta.ventaid,
        clienteid_anterior: selectedVenta.clienteid,
        clienteid_nuevo: parseInt(nuevoClienteId),
        fecha: traspasoFecha,
        notas: traspasoNotas.trim() || null,
        usuarioid: authData.user?.id ?? null,
        registrado_por: authData.user?.email ?? null,
      })
      if (insertError) throw insertError
      const { error: updateError } = await supabase
        .from('venta')
        .update({ clienteid: parseInt(nuevoClienteId) })
        .eq('ventaid', selectedVenta.ventaid)
      if (updateError) throw updateError
      setShowModal(false)
      setCurrentPage(1)
      // Force refetch by resetting ventaOptions so next open will re-fetch updated data
      setVentaOptions([])
      // Trigger list refresh
      setFilters({ ...filters })
    } catch (err: any) {
      setModalError(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArrowLeftRight size={28} className="text-indigo-600" />
            <h1 className="text-3xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Traspasos
            </h1>
            {!loading && (
              <span className="text-sm text-gray-400 font-normal mt-1">{totalItems} registro{totalItems !== 1 ? 's' : ''}</span>
            )}
          </div>
          <button
            type="button"
            onClick={openNuevoTraspaso}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#eaae4c' }}
          >
            <Plus size={16} />
            Nuevo Traspaso
          </button>
        </div>

        {/* Nuevo Traspaso Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={20} style={{ color: '#eaae4c' }} />
                  <h2 className="text-lg font-bold text-gray-900">Nuevo Traspaso</h2>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-5">
                {/* Venta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Venta activa <span className="text-red-500">*</span>
                  </label>
                  <SearchCombobox
                    options={ventaOptions}
                    value={selectedVentaId}
                    onChange={handleVentaSelect}
                    placeholder="Buscar venta por ID o lote…"
                  />
                </div>

                {/* Titular actual (read-only) */}
                {selectedVenta && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                    <span className="text-gray-500">Titular actual: </span>
                    <span className="font-semibold text-gray-800">{selectedVenta.clienteNombre}</span>
                  </div>
                )}

                {/* Nuevo titular */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nuevo titular <span className="text-red-500">*</span>
                  </label>
                  <SearchCombobox
                    options={clienteOptions.filter((c) => c.value !== selectedVenta?.clienteid.toString())}
                    value={nuevoClienteId}
                    onChange={setNuevoClienteId}
                    placeholder="Buscar cliente…"
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha del traspaso
                  </label>
                  <input
                    type="date"
                    value={traspasoFecha}
                    onChange={(e) => setTraspasoFecha(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={traspasoNotas}
                    onChange={(e) => setTraspasoNotas(e.target.value)}
                    rows={3}
                    placeholder="Motivo del traspaso, observaciones…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                  />
                </div>

                {modalError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{modalError}</p>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitTraspaso}
                  disabled={isSubmitting || !selectedVentaId || !nuevoClienteId}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: '#eaae4c' }}
                >
                  {isSubmitting ? 'Registrando…' : 'Confirmar Traspaso'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buscar cliente (anterior o nuevo)</label>
              <Input
                type="text"
                placeholder="Nombre del cliente…"
                value={filters.clienteNombre}
                onChange={(e) => setFilters({ ...filters, clienteNombre: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha desde</label>
              <Input
                type="date"
                value={filters.fechaDesde}
                onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha hasta</label>
              <Input
                type="date"
                value={filters.fechaHasta}
                onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">Cargando…</div>
          ) : traspasos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <ArrowLeftRight size={40} className="text-gray-300" />
              <p className="text-lg font-medium">Sin traspasos registrados</p>
              {(filters.clienteNombre || filters.fechaDesde || filters.fechaHasta) && (
                <p className="text-sm">Intenta ajustar los filtros</p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha traspaso</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Venta / Lote</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Titular anterior</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nuevo titular</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notas</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrado por</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrado el</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {traspasos.map((t, idx) => {
                      const lote = Array.isArray(t.venta?.lote) ? t.venta!.lote![0] : t.venta?.lote as any
                      const loteLabel = lote
                        ? `Mza ${lote.manzana} – Lote ${lote.nolote}${lote.clavelote ? ` (${lote.clavelote})` : ''}`
                        : '—'
                      return (
                        <tr key={t.traspasoid} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-gray-400">
                            {(currentPage - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {formatDate(t.fecha)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/ventas/${t.ventaid}`)}
                              className="text-blue-600 hover:underline font-medium flex items-center gap-1"
                            >
                              Venta #{t.ventaid}
                              <ExternalLink size={12} />
                            </button>
                            <span className="text-xs text-gray-400">{loteLabel}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                            {t.cliente_anterior?.nombre ?? `Cliente #${t.clienteid_anterior}`}
                          </td>
                          <td className="px-6 py-4">
                            <ArrowLeftRight size={16} className="text-indigo-400" />
                          </td>
                          <td className="px-6 py-4 text-sm text-indigo-700 font-semibold">
                            {t.cliente_nuevo?.nombre ?? `Cliente #${t.clienteid_nuevo}`}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-48 truncate" title={t.notas ?? ''}>
                            {t.notas || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {(t as any).registrado_por || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {formatDateTime(t.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/ventas/${t.ventaid}`)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                            >
                              Ver venta
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-500">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalItems)} de {totalItems}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-gray-700">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
