import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Input } from '@/components/ui/Input'
import { ChevronLeft, ChevronRight, ArrowLeftRight, ExternalLink } from 'lucide-react'
import type { Traspaso } from '@/types/database'
import { formatDate, formatDateTime } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

interface TraspasoWithDetails extends Traspaso {
  cliente_anterior: { nombre: string | null } | null
  cliente_nuevo: { nombre: string | null } | null
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
        </div>

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
