import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PagoForm } from '@/components/forms/PagoForm'
import type { PagoFormData } from '@/components/forms/PagoForm'
import { Eye, ChevronLeft, ChevronRight, Plus, Download, FileText, Filter } from 'lucide-react'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import { usePersistedFilters } from '@/hooks/usePersistedFilters'
import type { ComboOption } from '@/components/ui/SearchCombobox'
import type { Pago, CorridaFinanciera, Venta, Cliente, Lote, Desarrollo } from '@/types/database'
import {
  getPagoStatusLabel,
  getPagoStatusColor,
  getPagoFormaLabel,
  formatCurrency,
  formatDate,
  FORMAS_PAGO,
} from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { syncExpiredConvenios } from '@/services/convenios'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES, type AdminPanelRole } from '@/config/roles'

interface PagoWithDetails extends Pago {
  corridafinanciera?: CorridaFinanciera & {
    venta?: Venta & {
      cliente?: Cliente | Cliente[]
      lote?: (Lote & { desarrollo?: Desarrollo | Desarrollo[] }) | Array<Lote & { desarrollo?: Desarrollo | Desarrollo[] }>
    }
  }
}

type PendingRow = {
  clienteid: number
  clienteNombre: string
  desarrolloid: number | null
  ventaid: number
  fecha: string | null
  montoPendiente: number
}

const ALLOWED_DESARROLLOS = ['Desarrollo de Prueba', 'Pueblos de la Barranca']

const toCsv = (headers: string[], rows: (string | number)[][]): string => {
  const esc = (value: string | number) => {
    const raw = String(value ?? '')
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
  }

  const lines = [headers.map(esc).join(',')]
  for (const row of rows) lines.push(row.map(esc).join(','))
  return lines.join('\n')
}

const downloadCsv = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const getPagoAplicado = (pago: Pago) => {
  const monto = pago.montopagado || 0
  const aplicadoDeSaldo = Math.max(0, -(pago.servicios_extra || 0))
  return monto + aplicadoDeSaldo
}

const pickFirst = <T,>(value: T | T[] | null | undefined): T | undefined => {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

const getPagoContext = (pago: PagoWithDetails) => {
  const venta = pickFirst((pago.corridafinanciera as any)?.venta) as any
  const cliente = pickFirst(venta?.cliente) as Cliente | undefined
  const lote = pickFirst(venta?.lote) as (Lote & { desarrollo?: Desarrollo | Desarrollo[] }) | undefined
  const desarrollo = pickFirst(lote?.desarrollo) as Desarrollo | undefined

  return { venta, cliente, lote, desarrollo }
}

export const Pagos = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [allPagos, setAllPagos] = useState<PagoWithDetails[]>([])
  const [pendientes, setPendientes] = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = usePersistedFilters('pagosFilters', {
    clienteId: '',
    desarrolloId: '',
    fechaDesde: '',
    fechaHasta: '',
    formaPago: '',
    cobrador: '',
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [prevFilters, setPrevFilters] = useState(filters)
  const itemsPerPage = 10

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [showCreateModal, setShowCreateModal] = useState(() => searchParams.get('new') === 'true')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentRole = role && role in ROLE_CAPABILITIES ? (role as AdminPanelRole) : null
  const canRegistrarPagos = !!currentRole && ROLE_CAPABILITIES[currentRole].registrar_pagos

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      if (canRegistrarPagos) setShowCreateModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, canRegistrarPagos])

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

  const fetchPagosAndPendientes = async () => {
    try {
      setLoading(true)

      const [pagosRes, corridasRes, desarrollosRes] = await Promise.all([
        supabase
          .from('pagos')
          .select('pagoid, fechapago, montopagado, servicios_extra, formapago, cobrador, estatus, corridafinancieraid, cuenta_bancaria_id, referencia, comentario, recargo, corridafinanciera:corridafinanciera(corridafinancieraid, venta:venta(ventaid, clienteid, cliente:cliente(clienteid, nombre), lote:lote(loteid, desarrolloid, manzana, nolote, desarrollo:desarrollo(desarrolloid, nombre))))')
          .order('fechapago', { ascending: false })
          .limit(10000),
        supabase
          .from('corridafinanciera')
          .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad, venta:venta!inner(ventaid, estatus, cliente:cliente(clienteid, nombre), lote:lote(loteid, desarrolloid, desarrollo:desarrollo(desarrolloid, nombre)))')
          .gt('nopago', 0)
          .eq('venta.estatus', 'A'),
        supabase
          .from('desarrollo')
          .select('desarrolloid, nombre')
          .in('nombre', ALLOWED_DESARROLLOS)
          .order('nombre', { ascending: true }),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (corridasRes.error) throw corridasRes.error
      if (desarrollosRes.error) throw desarrollosRes.error

      const pagosRows = ((pagosRes.data || []) as unknown) as PagoWithDetails[]
      setAllPagos(pagosRows)
      setDesarrollos((desarrollosRes.data || []) as Desarrollo[])

      const pagosPorCorrida = new Map<number, Pago[]>()
      for (const pago of pagosRows) {
        if (pago.estatus === 'C') continue
        const corridaId = pago.corridafinancieraid || 0
        const list = pagosPorCorrida.get(corridaId) || []
        list.push(pago)
        pagosPorCorrida.set(corridaId, list)
      }

      const pendingRows: PendingRow[] = []
      for (const corrida of (corridasRes.data || []) as any[]) {
        const corridaId = corrida.corridafinancieraid as number
        const pagosCorrida = pagosPorCorrida.get(corridaId) || []
        const totalPagado = pagosCorrida.reduce((sum, p) => sum + getPagoAplicado(p), 0)
        const pendiente = Math.max(0, Number(corrida.mensualidad || 0) - totalPagado)
        if (pendiente <= 0) continue

        const venta = pickFirst(corrida.venta) as any
        const cliente = pickFirst(venta?.cliente) as Cliente | undefined
        const lote = pickFirst(venta?.lote) as (Lote & { desarrollo?: Desarrollo | Desarrollo[] }) | undefined
        const desarrollo = pickFirst(lote?.desarrollo) as Desarrollo | undefined
        const desarrolloid = (desarrollo?.desarrolloid ?? lote?.desarrolloid ?? null) as number | null

        if (DEMO_DESARROLLOIDS.length > 0 && desarrolloid && !DEMO_DESARROLLOIDS.includes(desarrolloid)) continue

        pendingRows.push({
          clienteid: cliente?.clienteid || 0,
          clienteNombre: cliente?.nombre || 'Sin cliente',
          desarrolloid,
          ventaid: corrida.ventaid || 0,
          fecha: corrida.fecha || null,
          montoPendiente: pendiente,
        })
      }

      setPendientes(pendingRows)
    } catch (error) {
      console.error('Error fetching pagos:', error)
      setAllPagos([])
      setPendientes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPagosAndPendientes()
  }, [])

  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(prevFilters)) {
      setCurrentPage(1)
      setPrevFilters(filters)
    }
  }, [filters, prevFilters])

  const filteredPagos = useMemo(() => {
    return allPagos.filter((pago) => {
      const { cliente, lote, desarrollo } = getPagoContext(pago)
      const desarrolloid = (desarrollo?.desarrolloid ?? lote?.desarrolloid ?? null) as number | null

      if (DEMO_DESARROLLOIDS.length > 0 && desarrolloid && !DEMO_DESARROLLOIDS.includes(desarrolloid)) return false
      if (filters.clienteId && String(cliente?.clienteid || '') !== filters.clienteId) return false
      if (filters.desarrolloId && String(desarrolloid || '') !== filters.desarrolloId) return false
      if (filters.fechaDesde && (pago.fechapago || '') < filters.fechaDesde) return false
      if (filters.fechaHasta && (pago.fechapago || '') > filters.fechaHasta) return false
      if (filters.formaPago && String(pago.formapago || '') !== filters.formaPago) return false
      if (filters.cobrador && !(pago.cobrador || '').toLowerCase().includes(filters.cobrador.toLowerCase())) return false
      return true
    })
  }, [allPagos, filters])

  const filteredPendientes = useMemo(() => {
    return pendientes.filter((p) => {
      if (filters.clienteId && String(p.clienteid) !== filters.clienteId) return false
      if (filters.desarrolloId && String(p.desarrolloid || '') !== filters.desarrolloId) return false
      if (filters.fechaDesde && (p.fecha || '') < filters.fechaDesde) return false
      if (filters.fechaHasta && (p.fecha || '') > filters.fechaHasta) return false
      return true
    })
  }, [pendientes, filters])

  const pendingByClient = useMemo(() => {
    const byClient = new Map<number, { clienteNombre: string; totalPendiente: number; corridasPendientes: number }>()

    for (const pending of filteredPendientes) {
      const current = byClient.get(pending.clienteid)
      if (current) {
        current.totalPendiente += pending.montoPendiente
        current.corridasPendientes += 1
      } else {
        byClient.set(pending.clienteid, {
          clienteNombre: pending.clienteNombre,
          totalPendiente: pending.montoPendiente,
          corridasPendientes: 1,
        })
      }
    }

    return Array.from(byClient.values()).sort((a, b) => b.totalPendiente - a.totalPendiente)
  }, [filteredPendientes])

  const totalItems = filteredPagos.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const pagos = filteredPagos.slice(startIndex, endIndex)

  const totalCobrado = filteredPagos.reduce((sum, p) => sum + Number(p.montopagado || 0), 0)
  const totalPendiente = filteredPendientes.reduce((sum, p) => sum + p.montoPendiente, 0)
  const clientesConAdeudo = pendingByClient.length

  const exportPagosCsv = () => {
    const csv = toCsv(
      ['Pago ID', 'Fecha', 'Cliente', 'Venta ID', 'Desarrollo', 'Metodo', 'Cobrador', 'Monto', 'Estado'],
      filteredPagos.map((pago) => {
        const { venta, cliente, desarrollo } = getPagoContext(pago)

        return [
          pago.pagoid || '',
          pago.fechapago || '',
          cliente?.nombre || '',
          venta?.ventaid || '',
          desarrollo?.nombre || '',
          getPagoFormaLabel(pago.formapago),
          pago.cobrador || '',
          Number(pago.montopagado || 0),
          getPagoStatusLabel(pago.estatus),
        ]
      })
    )

    downloadCsv(`tesoreria_pagos_${new Date().toISOString().split('T')[0]}.csv`, csv)
  }

  const exportPendientesCsv = () => {
    const csv = toCsv(
      ['Cliente', 'Corridas Pendientes', 'Total Pendiente'],
      pendingByClient.map((row) => [row.clienteNombre, row.corridasPendientes, row.totalPendiente])
    )

    downloadCsv(`tesoreria_pendientes_${new Date().toISOString().split('T')[0]}.csv`, csv)
  }

  const handleCreatePago = async (data: PagoFormData) => {
    if (!canRegistrarPagos) {
      alert('Tu rol no tiene permiso para registrar pagos.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        corridafinancieraid: data.corridafinancieraid,
        fechapago: data.fechapago,
        montopagado: data.montopagado,
        servicios_extra: data.servicios_extra,
        formapago: data.formapago,
        cuenta_bancaria_id: data.cuenta_bancaria_id,
        estatus: data.estatus,
        referencia: data.referencia,
        comentario: data.comentario,
        cobrador: data.cobrador,
      }

      let insertResult = await supabase.from('pagos').insert(payload).select().single()

      if (insertResult.error && /servicios_extra|cuenta_bancaria_id/i.test(insertResult.error.message || '')) {
        const fallbackComentario = [
          data.comentario,
          data.servicios_extra > 0 ? `[Servicios/Extra: ${data.servicios_extra}]` : null,
          data.formapago === 2 && data.cuenta_bancaria_id ? `[Cuenta bancaria ID: ${data.cuenta_bancaria_id}]` : null,
        ]
          .filter(Boolean)
          .join(' | ')

        insertResult = await supabase
          .from('pagos')
          .insert({
            corridafinancieraid: data.corridafinancieraid,
            fechapago: data.fechapago,
            montopagado: data.montopagado,
            formapago: data.formapago,
            estatus: data.estatus,
            referencia: data.referencia,
            comentario: fallbackComentario || null,
            cobrador: data.cobrador,
          })
          .select()
          .single()
      }

      if (insertResult.error) throw insertResult.error

      await syncExpiredConvenios()
      await fetchPagosAndPendientes()

      setShowCreateModal(false)
      navigate(`/admin/pagos/${insertResult.data.pagoid}`)
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
              <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
                TesorerÃ­a
              </h1>
              <p className="text-[#9e9f92] mt-2">Registro de pagos, filtros operativos y exportaciÃ³n CSV</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={fetchPagosAndPendientes} className="inline-flex items-center gap-2">
                <Filter size={16} /> Recargar
              </Button>
              <Button onClick={exportPagosCsv} className="inline-flex items-center gap-2">
                <Download size={16} /> Exportar Pagos CSV
              </Button>
              <Button variant="outline" onClick={exportPendientesCsv} className="inline-flex items-center gap-2">
                <FileText size={16} /> Exportar Pendientes CSV
              </Button>
              {canRegistrarPagos && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2"
                  style={{ backgroundColor: '#eaae4c', color: '#000' }}
                >
                  <Plus size={18} />
                  Nuevo Pago
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Cliente</label>
                <SearchCombobox
                  options={clientes.map((c): ComboOption => ({
                    value: String(c.clienteid),
                    label: c.nombre || 'Sin nombre',
                    sublabel: c.telefonocelular || c.telefono2 || undefined,
                  }))}
                  value={filters.clienteId}
                  onChange={(v) => setFilters({ ...filters, clienteId: v })}
                  placeholder="Buscar por nombre o telÃ©fono..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Desarrollo</label>
                <select
                  value={filters.desarrolloId}
                  onChange={(e) => setFilters({ ...filters, desarrolloId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                >
                  <option value="">Todos</option>
                  {desarrollos.map((d) => (
                    <option key={d.desarrolloid} value={d.desarrolloid}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Fecha Desde</label>
                <Input
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, fechaDesde: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Fecha Hasta</label>
                <Input
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, fechaHasta: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">MÃ©todo de cobranza</label>
                <select
                  value={filters.formaPago}
                  onChange={(e) => setFilters({ ...filters, formaPago: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                >
                  <option value="">Todos</option>
                  {FORMAS_PAGO.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Cobrador / Ruta</label>
                <Input
                  value={filters.cobrador}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, cobrador: e.target.value })}
                  placeholder="Nombre cobrador"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#eaae4c]">
              <p className="text-sm text-gray-500">Total cobrado</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCobrado)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#504840]">
              <p className="text-sm text-gray-500">Total pendiente</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPendiente)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#9e9f92]">
              <p className="text-sm text-gray-500">Clientes con adeudo</p>
              <p className="text-2xl font-bold text-gray-900">{clientesConAdeudo}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Pendientes (quiÃ©n debe y cuÃ¡nto)</h2>
            </div>
            {loading ? (
              <div className="py-10 text-center text-gray-500">Cargando...</div>
            ) : pendingByClient.length === 0 ? (
              <div className="py-10 text-center text-gray-500">No hay cartera pendiente con los filtros actuales.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Corridas pendientes</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingByClient.slice(0, 12).map((row) => (
                      <tr key={`${row.clienteNombre}-${row.corridasPendientes}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{row.clienteNombre}</td>
                        <td className="px-4 py-3 text-right">{row.corridasPendientes}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700">{formatCurrency(row.totalPendiente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DataTable<PagoWithDetails>
            emptyMessage="No se encontraron pagos con los filtros aplicados"
            columns={[
              {
                key: 'pagoid',
                label: 'Pago ID',
                width: 'w-20',
              },
              {
                key: 'cliente',
                label: 'Cliente',
                render: (row: PagoWithDetails) => getPagoContext(row).cliente?.nombre || '-',
              },
              {
                key: 'venta',
                label: 'Venta ID',
                render: (row: PagoWithDetails) => getPagoContext(row).venta?.ventaid || '-',
                width: 'w-24',
              },
              {
                key: 'fechapago',
                label: 'Fecha de Pago',
                render: (row: PagoWithDetails) => formatDate(row.fechapago),
              },
              {
                key: 'metodo',
                label: 'MÃ©todo',
                render: (row: PagoWithDetails) => getPagoFormaLabel(row.formapago),
              },
              {
                key: 'cobrador',
                label: 'Cobrador',
                render: (row: PagoWithDetails) => row.cobrador || '-',
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
              PÃ¡gina {totalItems === 0 ? 0 : currentPage} de {totalItems === 0 ? 0 : totalPages}
              {totalItems > 0 && ` (${startIndex + 1}-${Math.min(endIndex, totalItems)} de ${totalItems})`}
            </span>
            <Button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || totalItems === 0}
              variant="outline"
              className="inline-flex items-center gap-2"
            >
              Siguiente
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      </AdminLayout>

      {canRegistrarPagos && (
        <Modal
          isOpen={showCreateModal}
          title="Nuevo Pago"
          onClose={() => !isSubmitting && setShowCreateModal(false)}
          size="xl"
        >
          <PagoForm onSubmit={handleCreatePago} isLoading={isSubmitting} />
        </Modal>
      )}
    </>
  )
}
