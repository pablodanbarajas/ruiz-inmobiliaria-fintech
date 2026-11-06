import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable } from '@/components/DataTable'
import { supabase } from '@/lib/supabaseClient'
import { fetchAllByKey } from '@/lib/fetchAllByKey'
import { formatCurrency, formatDate, getPagoFormaLabel, FORMAS_PAGO } from '@/utils/helpers'
import type { Cliente, Desarrollo, Lote, Pago, Venta } from '@/types/database'
import { Download, RefreshCw, FileText } from 'lucide-react'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

const TABLE_PAGE_SIZE = 25

const toDateOnly = (value: string | null | undefined) => (value || '').slice(0, 10)

type PagoRow = Pago & {
  corridafinanciera?: {
    venta?: Venta & {
      cliente?: Cliente
      lote?: Lote & { desarrollo?: Desarrollo }
    }
  }
}

type PendingRow = {
  clienteid: number
  clienteNombre: string
  ventaid: number
  desarrolloNombre: string
  noPago: number
  fecha: string | null
  montoPendiente: number
  vencido: boolean
}

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
  const extra = pago.servicios_extra || 0
  return monto + extra
}

const TablePager = ({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) => {
  const lastPage = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE))
  if (total <= TABLE_PAGE_SIZE) return null
  return (
    <div className="mt-3 flex items-center justify-between gap-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
      <span className="text-sm text-gray-600">
        Página {page} de {lastPage} ({total.toLocaleString('es-MX')} registros)
      </span>
      <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>Siguiente</Button>
    </div>
  )
}

export const ReportesPagos = () => {
  const [loadingPagos, setLoadingPagos] = useState(true)
  const [loadingPendientes, setLoadingPendientes] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pagos, setPagos] = useState<PagoRow[]>([])
  const [pendientes, setPendientes] = useState<PendingRow[]>([])
  const [pagosPage, setPagosPage] = useState(1)
  const [pendientesPage, setPendientesPage] = useState(1)
  const latestRequest = useRef(0)

  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [desarrolloId, setDesarrolloId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [formaPago, setFormaPago] = useState('')
  const [cobrador, setCobrador] = useState('')

  useEffect(() => {
    const loadDesarrollos = async () => {
      let q = supabase.from('desarrollo').select('desarrolloid, nombre').order('nombre', { ascending: true })
      if (DEMO_DESARROLLOIDS.length > 0) q = q.in('desarrolloid', DEMO_DESARROLLOIDS) as typeof q
      const { data } = await q
      setDesarrollos((data || []) as Desarrollo[])
    }
    loadDesarrollos()
  }, [])

  const fetchReportData = async () => {
    const requestId = ++latestRequest.current
    const isStale = () => requestId !== latestRequest.current
    setLoadingPagos(true)
    setLoadingPendientes(true)
    setLoadError('')
    try {
      const pagosRows = await fetchAllByKey<PagoRow>(
        (afterKey, pageSize) => {
          let query = supabase
            .from('pagos')
            .select('pagoid, corridafinancieraid, fechapago, montopagado, servicios_extra, formapago, cobrador, estatus, corridafinanciera:corridafinanciera!inner(corridafinancieraid, venta:venta!inner(ventaid, estatus, cliente:cliente(clienteid, nombre), lote:lote!inner(loteid, desarrolloid, desarrollo:desarrollo(desarrolloid, nombre))))')
            .neq('estatus', 'C')
            .gt('pagoid', afterKey)
          if (DEMO_DESARROLLOIDS.length > 0) {
            query = query.in('corridafinanciera.venta.lote.desarrolloid', DEMO_DESARROLLOIDS)
          }
          return query.order('pagoid', { ascending: true }).limit(pageSize) as unknown as PromiseLike<{ data: PagoRow[] | null; error: unknown }>
        },
        (pago) => pago.pagoid,
      )
      if (isStale()) return

      pagosRows.sort((a, b) =>
        (b.fechapago || '').localeCompare(a.fechapago || '') || b.pagoid - a.pagoid
      )
      setPagos(pagosRows)
      setLoadingPagos(false)

      const corridas = await fetchAllByKey<any>(
        (afterKey, pageSize) => {
          let query = supabase
            .from('corridafinanciera')
            .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad, venta:venta!inner(ventaid, estatus, cliente:cliente(clienteid, nombre), lote:lote!inner(loteid, desarrolloid, desarrollo:desarrollo(desarrolloid, nombre)))')
            .gt('nopago', 0)
            .eq('venta.estatus', 'A')
            .gt('corridafinancieraid', afterKey)
          if (DEMO_DESARROLLOIDS.length > 0) {
            query = query.in('venta.lote.desarrolloid', DEMO_DESARROLLOIDS)
          }
          return query.order('corridafinancieraid', { ascending: true }).limit(pageSize)
        },
        (corrida) => corrida.corridafinancieraid,
      )
      if (isStale()) return

      const pagosPorCorrida = new Map<number, Pago[]>()
      for (const p of pagosRows) {
        const corridaId = p.corridafinancieraid || 0
        const list = pagosPorCorrida.get(corridaId) || []
        list.push(p)
        pagosPorCorrida.set(corridaId, list)
      }

      const today = new Date().toISOString().split('T')[0]
      const pendingRows: PendingRow[] = []

      for (const c of corridas) {
        const corridaId = c.corridafinancieraid as number
        const pagosCorrida = pagosPorCorrida.get(corridaId) || []
        const totalPagado = pagosCorrida.reduce((sum, p) => sum + getPagoAplicado(p), 0)
        const mensualidad = Number(c.mensualidad || 0)
        const pendiente = Math.max(0, mensualidad - totalPagado)
        if (pendiente <= 0) continue

        const cliente = Array.isArray(c.venta?.cliente) ? c.venta.cliente[0] : c.venta?.cliente
        const lote = Array.isArray(c.venta?.lote) ? c.venta.lote[0] : c.venta?.lote
        const desarrollo = Array.isArray(lote?.desarrollo) ? lote.desarrollo[0] : lote?.desarrollo

        pendingRows.push({
          clienteid: cliente?.clienteid || 0,
          clienteNombre: cliente?.nombre || 'Sin cliente',
          ventaid: c.ventaid || 0,
          desarrolloNombre: desarrollo?.nombre || 'Sin desarrollo',
          noPago: c.nopago || 0,
          fecha: c.fecha || null,
          montoPendiente: pendiente,
          vencido: !!c.fecha && c.fecha < today,
        })
      }

      setPendientes(pendingRows)
    } catch (error) {
      if (isStale()) return
      console.error('Error loading payment reports:', error)
      setLoadError('No se pudo cargar el reporte completo. Las cifras no están disponibles; intenta recargar.')
      setPagos([])
      setPendientes([])
    } finally {
      if (!isStale()) {
        setLoadingPagos(false)
        setLoadingPendientes(false)
      }
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [])

  const pagosFiltrados = useMemo(() => {
    return pagos.filter((p) => {
      const venta = p.corridafinanciera?.venta
      const lote = Array.isArray((venta as any)?.lote) ? (venta as any).lote[0] : (venta as any)?.lote
      const desarrollo = Array.isArray(lote?.desarrollo) ? lote.desarrollo[0] : lote?.desarrollo

      if (desarrolloId && String(desarrollo?.desarrolloid || '') !== desarrolloId) return false
      if (fechaDesde && toDateOnly(p.fechapago) < fechaDesde) return false
      if (fechaHasta && toDateOnly(p.fechapago) > fechaHasta) return false
      if (formaPago && String(p.formapago || '') !== formaPago) return false
      if (cobrador && !(p.cobrador || '').toLowerCase().includes(cobrador.toLowerCase())) return false
      return true
    })
  }, [pagos, desarrolloId, fechaDesde, fechaHasta, formaPago, cobrador])

  const pendientesFiltrados = useMemo(() => {
    return pendientes.filter((p) => {
      if (desarrolloId) {
        const dev = desarrollos.find((d) => String(d.desarrolloid) === desarrolloId)
        if (!dev || p.desarrolloNombre !== dev.nombre) return false
      }
      if (fechaDesde && toDateOnly(p.fecha) < fechaDesde) return false
      if (fechaHasta && toDateOnly(p.fecha) > fechaHasta) return false
      return true
    })
  }, [pendientes, desarrolloId, fechaDesde, fechaHasta, desarrollos])

  useEffect(() => setPagosPage(1), [pagosFiltrados])
  useEffect(() => setPendientesPage(1), [pendientesFiltrados])

  const totalCobrado = pagosFiltrados.reduce((sum, p) => sum + getPagoAplicado(p), 0)
  const totalPendiente = pendientesFiltrados.reduce((sum, p) => sum + p.montoPendiente, 0)
  const clientesPendientes = new Set(pendientesFiltrados.map((p) => p.clienteid)).size
  const pagosPorDesarrollo = useMemo(() => {
    const totals = new Map<string, number>()
    for (const pago of pagosFiltrados) {
      const venta = pago.corridafinanciera?.venta
      const lote = Array.isArray((venta as any)?.lote) ? (venta as any).lote[0] : (venta as any)?.lote
      const desarrollo = Array.isArray(lote?.desarrollo) ? lote.desarrollo[0] : lote?.desarrollo
      const nombre = desarrollo?.nombre || 'Sin desarrollo'
      totals.set(nombre, (totals.get(nombre) || 0) + getPagoAplicado(pago))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [pagosFiltrados])

  const pagosPorMetodo = useMemo(() => {
    const totals = new Map<string, number>()
    for (const pago of pagosFiltrados) {
      const metodo = getPagoFormaLabel(pago.formapago)
      totals.set(metodo, (totals.get(metodo) || 0) + getPagoAplicado(pago))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [pagosFiltrados])

  const renderPaymentChart = (title: string, values: [string, number][]) => {
    const max = Math.max(...values.map(([, value]) => value), 1)
    return (
      <div className="rounded-[16px] border border-[#e0e5e7] bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-[#142127]">{title}</h3>
        <div className="space-y-3">
          {loadingPagos ? (
            <p className="text-sm text-gray-500">Cargando pagos…</p>
          ) : values.length === 0 ? (
            <p className="text-sm text-gray-500">Sin pagos para mostrar.</p>
          ) : values.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between gap-3 text-xs text-gray-600">
                <span className="truncate">{label}</span>
                <span className="font-semibold text-gray-900">{formatCurrency(value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#142127]" style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const exportPagosCsv = () => {
    const csv = toCsv(
      ['Pago ID', 'Fecha', 'Cliente', 'Venta ID', 'Desarrollo', 'Metodo', 'Cobrador', 'Monto'],
      pagosFiltrados.map((p) => {
        const venta = p.corridafinanciera?.venta as any
        const cliente = Array.isArray(venta?.cliente) ? venta?.cliente[0] : venta?.cliente
        const lote = Array.isArray(venta?.lote) ? venta?.lote[0] : venta?.lote
        const desarrollo = Array.isArray(lote?.desarrollo) ? lote?.desarrollo[0] : lote?.desarrollo

        return [
          p.pagoid || '',
          p.fechapago || '',
          cliente?.nombre || '',
          venta?.ventaid || '',
          desarrollo?.nombre || '',
          getPagoFormaLabel(p.formapago),
          p.cobrador || '',
          Number(p.montopagado || 0),
        ]
      })
    )
    downloadCsv(`reporte_pagos_${new Date().toISOString().split('T')[0]}.csv`, csv)
  }

  const exportPendientesCsv = () => {
    const csv = toCsv(
      ['Cliente', 'Venta ID', 'Desarrollo', 'No Pago', 'Fecha limite', 'Pendiente', 'Estado'],
      pendientesFiltrados.map((p) => [
        p.clienteNombre,
        p.ventaid,
        p.desarrolloNombre,
        p.noPago,
        p.fecha || '',
        p.montoPendiente,
        p.vencido ? 'Vencido' : 'Por vencer',
      ])
    )
    downloadCsv(`reporte_pendientes_${new Date().toISOString().split('T')[0]}.csv`, csv)
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#63696c]">Control financiero</p>
            <h1 className="text-3xl md:text-4xl font-bold text-[#142127]" style={{ fontFamily: 'var(--font-display)' }}>
              Reportes de Pagos
            </h1>
            <p className="text-[#9e9f92] mt-2">Consulta de tesoreria con filtros operativos y exportacion CSV</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchReportData} className="inline-flex items-center gap-2">
              <RefreshCw size={16} /> Recargar
            </Button>
            <Button onClick={exportPagosCsv} className="inline-flex items-center gap-2">
              <Download size={16} /> Exportar Pagos CSV
            </Button>
            <Button variant="outline" onClick={exportPendientesCsv} className="inline-flex items-center gap-2">
              <FileText size={16} /> Exportar Pendientes CSV
            </Button>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="bg-white rounded-[20px] border border-[#e0e5e7] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Desarrollo</label>
              <select
                value={desarrolloId}
                onChange={(e) => setDesarrolloId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="">Todos</option>
                {desarrollos.map((d) => (
                  <option key={d.desarrolloid} value={d.desarrolloid}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Fecha desde</label>
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Fecha hasta</label>
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Metodo de cobro</label>
              <select
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="">Todos</option>
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Cobrador / Ruta</label>
              <Input value={cobrador} onChange={(e) => setCobrador(e.target.value)} placeholder="Nombre cobrador" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] border-l-4 border-l-[#fffa56] p-4">
            <p className="text-sm text-gray-500">Total cobrado</p>
            <p className="text-2xl font-bold text-gray-900">{loadingPagos ? '…' : formatCurrency(totalCobrado)}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] border-l-4 border-l-[#142127] p-4">
            <p className="text-sm text-gray-500">Total pendiente</p>
            <p className="text-2xl font-bold text-orange-600">{loadingPendientes ? '…' : formatCurrency(totalPendiente)}</p>
          </div>
          <div className="bg-white rounded-[16px] border border-[#e0e5e7] border-l-4 border-l-[#63696c] p-4">
            <p className="text-sm text-gray-500">Clientes con adeudo</p>
            <p className="text-2xl font-bold text-gray-900">{loadingPendientes ? '…' : clientesPendientes}</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {renderPaymentChart('Pagos por desarrollo', pagosPorDesarrollo)}
          {renderPaymentChart('Pagos por método de pago', pagosPorMetodo)}
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Pagos registrados</h2>
          <DataTable<PagoRow>
            data={pagosFiltrados.slice((pagosPage - 1) * TABLE_PAGE_SIZE, pagosPage * TABLE_PAGE_SIZE)}
            loading={loadingPagos}
            emptyMessage="No hay pagos con los filtros seleccionados"
            columns={[
              { key: 'pagoid', label: 'Pago ID' },
              { key: 'fechapago', label: 'Fecha', render: (r) => formatDate(r.fechapago) },
              {
                key: 'cliente',
                label: 'Cliente',
                render: (r) => {
                  const venta: any = r.corridafinanciera?.venta
                  const cliente = Array.isArray(venta?.cliente) ? venta.cliente[0] : venta?.cliente
                  return cliente?.nombre || '-'
                },
              },
              {
                key: 'desarrollo',
                label: 'Desarrollo',
                render: (r) => {
                  const venta: any = r.corridafinanciera?.venta
                  const lote = Array.isArray(venta?.lote) ? venta.lote[0] : venta?.lote
                  const desarrollo = Array.isArray(lote?.desarrollo) ? lote.desarrollo[0] : lote?.desarrollo
                  return desarrollo?.nombre || '-'
                },
              },
              { key: 'formapago', label: 'Metodo', render: (r) => getPagoFormaLabel(r.formapago) },
              { key: 'cobrador', label: 'Cobrador', render: (r) => r.cobrador || '-' },
              { key: 'montopagado', label: 'Monto', render: (r) => formatCurrency(r.montopagado) },
            ]}
          />
          {!loadingPagos && <TablePager page={pagosPage} total={pagosFiltrados.length} onChange={setPagosPage} />}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Pendientes de cobro (quien debe y cuanto)</h2>
          <DataTable<PendingRow>
            data={pendientesFiltrados.slice((pendientesPage - 1) * TABLE_PAGE_SIZE, pendientesPage * TABLE_PAGE_SIZE)}
            loading={loadingPendientes}
            emptyMessage="No hay pendientes con los filtros seleccionados"
            columns={[
              { key: 'clienteNombre', label: 'Cliente' },
              { key: 'ventaid', label: 'Venta ID' },
              { key: 'desarrolloNombre', label: 'Desarrollo' },
              { key: 'noPago', label: 'No Pago' },
              { key: 'fecha', label: 'Fecha limite', render: (r) => formatDate(r.fecha) },
              { key: 'montoPendiente', label: 'Pendiente', render: (r) => formatCurrency(r.montoPendiente) },
              {
                key: 'estado',
                label: 'Estado',
                render: (r) => (
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${r.vencido ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {r.vencido ? 'Vencido' : 'Por vencer'}
                  </span>
                ),
              },
            ]}
          />
          {!loadingPendientes && <TablePager page={pendientesPage} total={pendientesFiltrados.length} onChange={setPendientesPage} />}
        </div>
      </div>
    </AdminLayout>
  )
}
