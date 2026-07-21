import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ApartadoExternoForm } from '@/components/forms/ApartadoExternoForm'
import type { ApartadoExternoFormData } from '@/components/forms/ApartadoExternoForm'
import { formatDate, getVentaStatusLabel, getVentaStatusColor, formatCurrency } from '@/utils/helpers'
import { Plus, Eye, RefreshCw, XCircle, Pencil, CheckCircle2 } from 'lucide-react'
import type { Venta, Cliente, Lote, Desarrollo } from '@/types/database'

interface VentaExternaRow extends Venta {
  cliente?: Cliente
  lote?: Lote & { desarrollo?: Desarrollo }
}

const today = new Date().toISOString().split('T')[0]

// Statuses shown in this module
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estatus' },
  { value: 'P', label: 'Pendiente de formalizar' },
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
  const [confirmCancel, setConfirmCancel] = useState<VentaExternaRow | null>(null)

  // ── Formalizar state ────────────────────────────────────
  const [formalizarRow, setFormalizarRow] = useState<VentaExternaRow | null>(null)
  const [formalizarData, setFormalizarData] = useState({
    preciolote: '',
    enganche: '',
    fechacontrato: today,
    fechaenganche: today,
    plazo: '',
    fechaprimeramensualidad: '',
  })
  const [formalizarErrors, setFormalizarErrors] = useState<Record<string, string>>({})
  const [formalizando, setFormalizando] = useState(false)

  // ── Edit client state ────────────────────────────────
  const [editClienteRow, setEditClienteRow] = useState<VentaExternaRow | null>(null)
  const [editClienteForm, setEditClienteForm] = useState<Partial<Cliente>>({})
  const [editClienteErrors, setEditClienteErrors] = useState<Record<string, string>>({})
  const [savingCliente, setSavingCliente] = useState(false)

  // ── Filters (admin only) ─────────────────────────────────
  const [filterVendedor, setFilterVendedor] = useState('')
  const [filterEstatus, setFilterEstatus] = useState('')
  const [vendorEmailMap, setVendorEmailMap] = useState<Record<string, string>>({})
  // ── Open formalizar modal ─────────────────────────────────
  const openFormalizar = (row: VentaExternaRow) => {
    setFormalizarRow(row)
    setFormalizarData({
      preciolote: row.lote?.preciolote?.toString() ?? '',
      enganche: '',
      fechacontrato: today,
      fechaenganche: today,
      plazo: '',
      fechaprimeramensualidad: '',
    })
    setFormalizarErrors({})
  }

  const handleFormalizar = async () => {
    const errs: Record<string, string> = {}
    const precio = parseFloat(formalizarData.preciolote)
    const engancheNum = parseFloat(formalizarData.enganche)
    const plazoNum = parseInt(formalizarData.plazo)
    if (!precio || precio <= 0) errs.preciolote = 'Requerido'
    if (isNaN(engancheNum) || engancheNum < 0) errs.enganche = 'Requerido'
    if (!isNaN(precio) && !isNaN(engancheNum) && engancheNum >= precio)
      errs.enganche = 'El enganche no puede ser mayor o igual al precio'
    if (!plazoNum || plazoNum <= 0) errs.plazo = 'Requerido'
    if (!formalizarData.fechacontrato) errs.fechacontrato = 'Requerida'
    if (!formalizarData.fechaenganche) errs.fechaenganche = 'Requerida'
    if (!formalizarData.fechaprimeramensualidad) errs.fechaprimeramensualidad = 'Requerida'
    setFormalizarErrors(errs)
    if (Object.keys(errs).length > 0) return

    setFormalizando(true)
    try {
      const porcenganche = parseFloat(((engancheNum / precio) * 100).toFixed(2))

      // 1. Actualizar venta con campos financieros y cambiar a 'E' (En enganche)
      const { error: updateErr } = await supabase
        .from('venta')
        .update({
          preciolote: precio,
          enganche: engancheNum,
          porcenganche,
          fechacontrato: formalizarData.fechacontrato,
          fechaenganche: formalizarData.fechaenganche,
          estatus: 'E',
        })
        .eq('ventaid', formalizarRow!.ventaid)
      if (updateErr) throw new Error(updateErr.message)

      // 2. Llamar edge function formalize-sale para generar corrida financiera
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/formalize-sale`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            ventaid: formalizarRow!.ventaid,
            plazo: plazoNum,
            fechaprimeramensualidad: formalizarData.fechaprimeramensualidad,
          }),
        }
      )
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al formalizar')

      setFormalizarRow(null)
      await loadData()
    } catch (err: any) {
      setFormalizarErrors({ _general: err.message })
    } finally {
      setFormalizando(false)
    }
  }
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

        // Load vendor emails to display when vendedor name is missing
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          if (token) {
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admin-users`,
              { headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
            )
            if (res.ok) {
              const result = await res.json()
              const map: Record<string, string> = {}
              for (const u of result.users ?? []) {
                if (u.user_id && u.email) map[u.user_id] = u.email
              }
              setVendorEmailMap(map)
            }
          }
        } catch { /* non-critical */ }
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

  // ── Open edit client modal ──────────────────────────
  const openEditCliente = (row: VentaExternaRow) => {
    setEditClienteRow(row)
    setEditClienteForm(row.cliente ? { ...row.cliente } : {})
    setEditClienteErrors({})
  }

  const handleSaveCliente = async () => {
    const errs: Record<string, string> = {}
    if (!editClienteForm.nombre?.trim()) errs.nombre = 'Nombre requerido'
    if (!editClienteForm.telefonocelular?.trim()) errs.telefonocelular = 'Teléfono requerido'
    if (
      editClienteForm.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editClienteForm.email.trim())
    ) errs.email = 'Email inválido'
    if (
      editClienteForm.rfc?.trim() &&
      !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}$/i.test(editClienteForm.rfc.trim())
    ) errs.rfc = 'RFC inválido'
    if (
      editClienteForm.curp?.trim() &&
      !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}$/i.test(editClienteForm.curp.trim())
    ) errs.curp = 'CURP inválido (18 caracteres)'
    setEditClienteErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSavingCliente(true)
    try {
      const { error } = await supabase
        .from('cliente')
        .update({
          nombre: editClienteForm.nombre?.trim() ?? null,
          telefonocelular: editClienteForm.telefonocelular?.trim() ?? null,
          telefono2: editClienteForm.telefono2?.trim() || null,
          email: editClienteForm.email?.trim().toLowerCase() || null,
          rfc: editClienteForm.rfc?.trim().toUpperCase() || null,
          curp: editClienteForm.curp?.trim().toUpperCase() || null,
          calle: editClienteForm.calle?.trim() || null,
          numeroext: editClienteForm.numeroext?.trim() || null,
          colonia: editClienteForm.colonia?.trim() || null,
          municipio_ciudad: editClienteForm.municipio_ciudad?.trim() || null,
          estado: editClienteForm.estado?.trim() || null,
          codigopostal: editClienteForm.codigopostal?.trim() || null,
          comentarios: editClienteForm.comentarios?.trim() || null,
        })
        .eq('clienteid', editClienteRow!.clienteid!)
      if (error) throw error
      setEditClienteRow(null)
      await loadData()
    } catch (err: any) {
      setEditClienteErrors({ _general: err.message })
    } finally {
      setSavingCliente(false)
    }
  }

  // ── Cancel apartado ──────────────────────────────────────
  const handleCancelApartado = async (row: VentaExternaRow) => {
    setConfirmCancel(null)
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
      const nombreCompleto = [user?.nombre, user?.apellido].filter(s => s?.trim()).join(' ').trim()
      const vendedorNombre = nombreCompleto || user?.email || null

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
            fecha_reserva: new Date().toISOString(),
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
      // Solo admins van al detalle; el vendedor externo se queda en su lista
      if (isAdmin) {
        navigate(`/admin/ventas/${ventaData.ventaid}`, { state: { from: '/admin/ventas-externas' } })
      }
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
                        {row.vendedor
                          ? row.vendedor
                          : row.vendedor_user_id
                            ? <span className="text-gray-400 italic text-xs">{vendorEmailMap[row.vendedor_user_id] ?? row.vendedor_user_id.substring(0, 8) + '…'}</span>
                            : '—'
                        }
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
                        {isAdmin && (
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
                        )}
                        {isAdmin && row.estatus === 'P' && (
                          <button
                            onClick={() => openFormalizar(row)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
                          >
                            <CheckCircle2 size={13} />
                            Formalizar
                          </button>
                        )}
                        {row.estatus !== 'C' && (
                          <button
                            onClick={() => openEditCliente(row)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                          >
                            <Pencil size={13} />
                            Editar cliente
                          </button>
                        )}
                        {row.estatus === 'P' && (
                          <button
                            onClick={() => setConfirmCancel(row)}
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

      {/* Edit client modal */}
      <Modal
        isOpen={!!editClienteRow}
        onClose={() => !savingCliente && setEditClienteRow(null)}
        title="Editar datos del cliente"
      >
        {editClienteErrors._general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {editClienteErrors._general}
          </div>
        )}
        <div className="space-y-5">
          {/* Datos básicos */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Datos básicos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <Input
                  value={editClienteForm.nombre ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, nombre: e.target.value })}
                />
                {editClienteErrors.nombre && <p className="text-red-500 text-xs mt-1">{editClienteErrors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono celular *</label>
                <Input
                  type="tel"
                  value={editClienteForm.telefonocelular ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, telefonocelular: e.target.value })}
                />
                {editClienteErrors.telefonocelular && <p className="text-red-500 text-xs mt-1">{editClienteErrors.telefonocelular}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono 2</label>
                <Input
                  type="tel"
                  value={editClienteForm.telefono2 ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, telefono2: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <Input
                  type="email"
                  value={editClienteForm.email ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, email: e.target.value })}
                />
                {editClienteErrors.email && <p className="text-red-500 text-xs mt-1">{editClienteErrors.email}</p>}
              </div>
            </div>
          </div>

          {/* Documentos oficiales */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Documentos oficiales
              <span className="ml-2 font-normal normal-case text-gray-400">(completar cuando estén disponibles)</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                <Input
                  placeholder="XAXX000101000 (opcional)"
                  value={editClienteForm.rfc ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, rfc: e.target.value.toUpperCase() })}
                  maxLength={13}
                />
                {editClienteErrors.rfc && <p className="text-red-500 text-xs mt-1">{editClienteErrors.rfc}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CURP</label>
                <Input
                  placeholder="18 caracteres (opcional)"
                  value={editClienteForm.curp ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, curp: e.target.value.toUpperCase() })}
                  maxLength={18}
                />
                {editClienteErrors.curp && <p className="text-red-500 text-xs mt-1">{editClienteErrors.curp}</p>}
              </div>
            </div>
          </div>

          {/* Domicilio */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Domicilio</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
                <Input
                  value={editClienteForm.calle ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, calle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número exterior</label>
                <Input
                  value={editClienteForm.numeroext ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, numeroext: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colonia</label>
                <Input
                  value={editClienteForm.colonia ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, colonia: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                <Input
                  value={editClienteForm.codigopostal ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, codigopostal: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Municipio / Ciudad</label>
                <Input
                  value={editClienteForm.municipio_ciudad ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, municipio_ciudad: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <Input
                  value={editClienteForm.estado ?? ''}
                  onChange={(e) => setEditClienteForm({ ...editClienteForm, estado: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={editClienteForm.comentarios ?? ''}
              onChange={(e) => setEditClienteForm({ ...editClienteForm, comentarios: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setEditClienteRow(null)} disabled={savingCliente}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCliente} disabled={savingCliente}>
              {savingCliente ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Formalizar venta modal */}
      {formalizarRow && (() => {
        const precio = parseFloat(formalizarData.preciolote) || 0
        const engancheNum = parseFloat(formalizarData.enganche) || 0
        const plazoNum = parseInt(formalizarData.plazo) || 0
        const saldo = precio - engancheNum
        const mensualidadPreview = plazoNum > 0 && saldo > 0 ? saldo / plazoNum : null
        return (
          <Modal
            isOpen
            onClose={() => !formalizando && setFormalizarRow(null)}
            title="Formalizar Venta"
          >
            <div className="space-y-5">
              {/* Info del apartado */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-amber-800">
                  {formalizarRow.cliente?.nombre ?? `Cliente #${formalizarRow.clienteid}`}
                </p>
                <p className="text-amber-700">
                  {formalizarRow.lote
                    ? `Mza ${formalizarRow.lote.manzana} Lote ${formalizarRow.lote.nolote} · ${formalizarRow.lote.desarrollo?.nombre ?? ''}`
                    : `Lote #${formalizarRow.loteid}`}
                </p>
              </div>

              {formalizarErrors._general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {formalizarErrors._general}
                </div>
              )}

              {/* Precios */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio del lote *</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={formalizarData.preciolote}
                    onChange={(e) => setFormalizarData({ ...formalizarData, preciolote: e.target.value })}
                  />
                  {formalizarErrors.preciolote && <p className="text-red-500 text-xs mt-1">{formalizarErrors.preciolote}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enganche *
                    {precio > 0 && engancheNum > 0 && (
                      <span className="ml-2 text-gray-400 font-normal">
                        ({((engancheNum / precio) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={formalizarData.enganche}
                    onChange={(e) => setFormalizarData({ ...formalizarData, enganche: e.target.value })}
                  />
                  {formalizarErrors.enganche && <p className="text-red-500 text-xs mt-1">{formalizarErrors.enganche}</p>}
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de contrato *</label>
                  <Input
                    type="date"
                    value={formalizarData.fechacontrato}
                    onChange={(e) => setFormalizarData({ ...formalizarData, fechacontrato: e.target.value })}
                  />
                  {formalizarErrors.fechacontrato && <p className="text-red-500 text-xs mt-1">{formalizarErrors.fechacontrato}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite enganche *</label>
                  <Input
                    type="date"
                    value={formalizarData.fechaenganche}
                    onChange={(e) => setFormalizarData({ ...formalizarData, fechaenganche: e.target.value })}
                  />
                  {formalizarErrors.fechaenganche && <p className="text-red-500 text-xs mt-1">{formalizarErrors.fechaenganche}</p>}
                </div>
              </div>

              {/* Plazo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plazo (meses) *</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="ej. 120"
                    value={formalizarData.plazo}
                    onChange={(e) => setFormalizarData({ ...formalizarData, plazo: e.target.value })}
                  />
                  {formalizarErrors.plazo && <p className="text-red-500 text-xs mt-1">{formalizarErrors.plazo}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primera mensualidad *</label>
                  <Input
                    type="date"
                    value={formalizarData.fechaprimeramensualidad}
                    onChange={(e) => setFormalizarData({ ...formalizarData, fechaprimeramensualidad: e.target.value })}
                  />
                  {formalizarErrors.fechaprimeramensualidad && <p className="text-red-500 text-xs mt-1">{formalizarErrors.fechaprimeramensualidad}</p>}
                </div>
              </div>

              {/* Preview mensualidad */}
              {mensualidadPreview !== null && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                  <p className="text-green-800">
                    <span className="font-semibold">Mensualidad estimada: </span>
                    {formatCurrency(mensualidadPreview)} / mes × {plazoNum} meses
                  </p>
                  <p className="text-green-700 mt-0.5">
                    Saldo a financiar: {formatCurrency(saldo)}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" onClick={() => setFormalizarRow(null)} disabled={formalizando}>
                  Cancelar
                </Button>
                <Button onClick={handleFormalizar} disabled={formalizando}>
                  {formalizando ? 'Formalizando…' : 'Confirmar y generar corrida'}
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Confirm cancel modal */}
      <Modal
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Cancelar apartado"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas cancelar el apartado de{' '}
            <span className="font-semibold">{confirmCancel?.cliente?.nombre ?? 'este cliente'}</span>?
          </p>
          <p className="text-sm text-gray-500">
            El lote quedará disponible nuevamente para otros clientes.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmCancel && handleCancelApartado(confirmCancel)}
              disabled={cancelingId !== null}
            >
              {cancelingId !== null ? 'Cancelando…' : 'Sí, cancelar apartado'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
