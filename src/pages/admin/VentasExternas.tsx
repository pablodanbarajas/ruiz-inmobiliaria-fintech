import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ApartadoExternoForm } from '@/components/forms/ApartadoExternoForm'
import type { ApartadoExternoFormData } from '@/components/forms/ApartadoExternoForm'
import { formatDate, getVentaStatusLabel, getVentaStatusColor } from '@/utils/helpers'
import { Plus, Eye, RefreshCw, XCircle } from 'lucide-react'
import type { Venta, Cliente, Lote, Desarrollo } from '@/types/database'

interface VentaExternaRow extends Venta {
  cliente?: Cliente
  lote?: Lote & { desarrollo?: Desarrollo }
}

// Statuses shown in this module
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estatus' },
  { value: 'P', label: 'Reserva pendiente' },
  { value: 'E', label: 'En enganche' },
  { value: 'A', label: 'Activa' },
  { value: 'C', label: 'Cancelada' },
]

export const VentasExternas = () => {
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const isAdmin = role === 'admin' || role === 'finanzas'
  const isVendedorExterno = role === 'vendedor_externo'

  const [rows, setRows] = useState<VentaExternaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<number | null>(null)

  // ── Filters (admin only) ─────────────────────────────────
  const [filterVendedor, setFilterVendedor] = useState('')
  const [filterEstatus, setFilterEstatus] = useState('')

  // ── Load data ────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('venta')
        .select('*, cliente:cliente(*), lote:lote(*, desarrollo:desarrollo(*))')
        .order('fecha', { ascending: false })

      if (isVendedorExterno && user?.id) {
        // Vendedor externo: only their own apartados
        query = query.eq('vendedor_user_id', user.id)
      } else if (isAdmin) {
        // Admin: only ventas created by vendedor_externo users
        // We identify them by joining user_roles
        const { data: vrData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'vendedor_externo')

        const vendedorIds = (vrData ?? []).map((r: { user_id: string }) => r.user_id)
        if (vendedorIds.length === 0) {
          setRows([])
          setLoading(false)
          return
        }
        query = query.in('vendedor_user_id', vendedorIds)
      } else {
        setRows([])
        setLoading(false)
        return
      }

      const { data, error } = await query
      if (error) throw error
      setRows((data ?? []) as VentaExternaRow[])
    } catch (err) {
      console.error('Error loading ventas externas:', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && role) loadData()
  }, [user, role])

  // ── Client-side filtering (admin) ────────────────────────
  const filtered = useMemo(() => {
    let list = rows
    if (filterEstatus) list = list.filter((r) => r.estatus === filterEstatus)
    if (filterVendedor) {
      const term = filterVendedor.toLowerCase()
      list = list.filter((r) => (r.vendedor ?? '').toLowerCase().includes(term))
    }
    return list
  }, [rows, filterEstatus, filterVendedor])

  // ── Unique vendor names for dropdown ─────────────────────
  const vendedorOptions = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.vendedor).filter(Boolean))]
    return names.sort()
  }, [rows])

  // ── Cancel apartado ──────────────────────────────────────
  const handleCancelApartado = async (row: VentaExternaRow) => {
    const confirmed = window.confirm(
      `¿Cancelar el apartado de ${row.cliente?.nombre ?? 'este cliente'}?\nEl lote quedará disponible nuevamente.`
    )
    if (!confirmed) return
    setCancelingId(row.ventaid)
    try {
      const { error: ventaErr } = await supabase
        .from('venta')
        .update({ estatus: 'C' })
        .eq('ventaid', row.ventaid)
      if (ventaErr) throw new Error(ventaErr.message)

      if (row.loteid) {
        await supabase
          .from('lote')
          .update({ estatus: 'D' })
          .eq('loteid', row.loteid)
          .eq('estatus', 'A') // only revert if still 'Apartado'
      }
      await loadData()
    } catch (err: any) {
      alert(`Error al cancelar: ${err.message}`)
    } finally {
      setCancelingId(null)
    }
  }

  // ── Create apartado ──────────────────────────────────────
  const handleCreateApartado = async (data: ApartadoExternoFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const vendedorUserId = authData.user?.id ?? null
      const vendedorNombre = user ? `${user.nombre} ${user.apellido}`.trim() : null

      // ── 1. Create or use existing client ─────────────────
      let clienteid: number
      if (data.clienteId !== null) {
        clienteid = data.clienteId
      } else {
        const insertClient: Record<string, string | null> = {
          nombre: data.clienteNombre,
          telefonocelular: data.clienteTelefono || null,
          email: data.clienteEmail.trim() || null,
          rfc: data.clienteRfc.trim() ? data.clienteRfc.trim().toUpperCase() : null,
          curp: data.clienteCurp.trim() ? data.clienteCurp.trim().toUpperCase() : null,
          estatus: 'A',
        }
        const { data: clienteData, error: clienteError } = await supabase
          .from('cliente')
          .insert([insertClient])
          .select('clienteid')
          .single()
        if (clienteError) throw new Error(`Error al registrar cliente: ${clienteError.message}`)
        clienteid = clienteData.clienteid
      }

      // ── 2. Lock lote: D → A (Apartado) ───────────────────
      const { data: lockedLote, error: lockError } = await supabase
        .from('lote')
        .update({ estatus: 'A' })
        .eq('loteid', data.loteid)
        .eq('estatus', 'D')
        .select()

      if (lockError) throw new Error(lockError.message)
      if (!lockedLote || lockedLote.length === 0) {
        throw new Error('El lote seleccionado ya no está disponible. Fue reservado por otro usuario.')
      }

      // ── 3. Insert venta (apartado) ────────────────────────
      const today = new Date().toISOString().split('T')[0]
      const { data: ventaData, error: ventaError } = await supabase
        .from('venta')
        .insert([
          {
            loteid: data.loteid,
            clienteid,
            fecha: data.fecha || today,
            usuarioid: null,
            vendedor_user_id: vendedorUserId,
            vendedor: vendedorNombre,
            estatus: 'P',
            comentarios: data.comentarios || null,
            // Financial fields intentionally null — to be completed by contratos/admin
            preciolote: null,
            enganche: null,
            porcenganche: null,
            fechaenganche: null,
            plazo: null,
            fechaprimeramensualidad: null,
            mensualidad: null,
            fechacontrato: null,
            plazoenganche: null,
          },
        ])
        .select()
        .single()

      if (ventaError) {
        // Rollback lote
        await supabase.from('lote').update({ estatus: 'D' }).eq('loteid', data.loteid)
        throw new Error(`Error al registrar apartado: ${ventaError.message}`)
      }

      setShowModal(false)
      await loadData()
      navigate(`/admin/ventas/${ventaData.ventaid}`, { state: { from: '/admin/ventas-externas' } })
    } catch (err: any) {
      setSubmitError(err.message ?? 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isVendedorExterno ? 'Mis Apartados' : 'Ventas Externas'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isVendedorExterno
                ? 'Historial de apartados que has realizado'
                : 'Apartados registrados por vendedores externos'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button onClick={() => { setSubmitError(null); setShowModal(true) }}>
              <Plus size={16} className="mr-1" />
              Nuevo Apartado
            </Button>
          </div>
        </div>

        {/* Admin filters */}
        {isAdmin && (
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex-1 min-w-48">
              <input
                type="text"
                placeholder="Filtrar por vendedor…"
                value={filterVendedor}
                onChange={(e) => setFilterVendedor(e.target.value)}
                list="vendedor-options"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
              />
              <datalist id="vendedor-options">
                {vendedorOptions.map((v) => (
                  <option key={v} value={v ?? ''} />
                ))}
              </datalist>
            </div>
            <select
              value={filterEstatus}
              onChange={(e) => setFilterEstatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#eaae4c]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {isVendedorExterno
              ? 'Aún no has registrado ningún apartado.'
              : 'No hay apartados con los filtros seleccionados.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Teléfono</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Lote</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Desarrollo</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Vendedor</th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Estatus</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.ventaid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatDate(row.fecha)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {row.cliente?.nombre ?? `#${row.clienteid}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.cliente?.telefonocelular ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.lote
                        ? `Mza ${row.lote.manzana} Lote ${row.lote.nolote}`
                        : `#${row.loteid}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.lote?.desarrollo?.nombre ?? '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-700">
                        {row.vendedor ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getVentaStatusColor(row.estatus)}`}
                      >
                        {getVentaStatusLabel(row.estatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            navigate(`/admin/ventas/${row.ventaid}`, {
                              state: { from: '/admin/ventas-externas' },
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                        >
                          <Eye size={13} />
                          Ver
                        </button>
                        {row.estatus === 'P' && (
                          <button
                            onClick={() => handleCancelApartado(row)}
                            disabled={cancelingId === row.ventaid}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            {cancelingId === row.ventaid ? '…' : 'Cancelar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary row */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-gray-500 mt-3 text-right">
            {filtered.length} apartado{filtered.length !== 1 ? 's' : ''} mostrado
            {filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Create apartado modal */}
      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
        title="Nuevo Apartado"
      >
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {submitError}
          </div>
        )}
        <ApartadoExternoForm onSubmit={handleCreateApartado} isLoading={isSubmitting} />
      </Modal>
    </AdminLayout>
  )
}
