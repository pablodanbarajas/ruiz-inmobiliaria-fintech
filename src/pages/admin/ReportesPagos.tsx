import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable } from '@/components/DataTable'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency, formatDate, getPagoFormaLabel, FORMAS_PAGO } from '@/utils/helpers'
import type { Cliente, Desarrollo, Lote, Pago, Venta } from '@/types/database'
import { Download, Filter, FileText } from 'lucide-react'

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
  const aplicadoDeSaldo = Math.max(0, -(pago.servicios_extra || 0))
  return monto + aplicadoDeSaldo
}

export const ReportesPagos = () => {
  const [loading, setLoading] = useState(true)
  const [pagos, setPagos] = useState<PagoRow[]>([])
  const [pendientes, setPendientes] = useState<PendingRow[]>([])

  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [desarrolloId, setDesarrolloId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [formaPago, setFormaPago] = useState('')
  const [cobrador, setCobrador] = useState('')

  useEffect(() => {
    const loadDesarrollos = async () => {
      const { data } = await supabase.from('desarrollo').select('desarrolloid, nombre').order('nombre', { ascending: true })
      setDesarrollos((data || []) as Desarrollo[])
    }
    loadDesarrollos()
  }, [])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const [pagosRes, corridasRes] = await Promise.all([
        supabase
          .from('pagos')
          .select('*, corridafinanciera:corridafinanciera(*, venta:venta(ventaid, estatus, cliente:cliente(clienteid, nombre), lote:lote(loteid, desarrolloid, manzana, nolote, desarrollo:desarrollo(desarrolloid, nombre))))')
          .neq('estatus', 'C')
          .order('fechapago', { ascending: false }),
        supabase
          .from('corridafinanciera')
          .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad, venta:venta!inner(ventaid, estatus, cliente:cliente(clienteid, nombre), lote:lote(loteid, desarrolloid, manzana, nolote, desarrollo:desarrollo(desarrolloid, nombre)))')
          .gt('nopago', 0)
          .eq('venta.estatus', 'A'),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (corridasRes.error) throw corridasRes.error

      const pagosRows = (pagosRes.data || []) as PagoRow[]
      setPagos(pagosRows)

      const pagosPorCorrida = new Map<number, Pago[]>()
      for (const p of pagosRows) {
        const corridaId = p.corridafinancieraid || 0
        const list = pagosPorCorrida.get(corridaId) || []
        list.push(p)
        pagosPorCorrida.set(corridaId, list)
      }

      const today = new Date().toISOString().split('T')[0]
      const pendingRows: PendingRow[] = []

      for (const c of (corridasRes.data || []) as any[]) {
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
      console.error('Error loading payment reports:', error)
      setPagos([])
      setPendientes([])
    } finally {
      setLoading(false)
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
      if (fechaDesde && (p.fechapago || '') < fechaDesde) return false
      if (fechaHasta && (p.fechapago || '') > fechaHasta) return false
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
      if (fechaDesde && (p.fecha || '') < fechaDesde) return false
      if (fechaHasta && (p.fecha || '') > fechaHasta) return false
      return true
    })
  }, [pendientes, desarrolloId, fechaDesde, fechaHasta, desarrollos])

  const totalCobrado = pagosFiltrados.reduce((sum, p) => sum + Number(p.montopagado || 0), 0)
  const totalPendiente = pendientesFiltrados.reduce((sum, p) => sum + p.montoPendiente, 0)
  const clientesPendientes = new Set(pendientesFiltrados.map((p) => p.clienteid)).size

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
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Reportes de Pagos
            </h1>
            <p className="text-[#9e9f92] mt-2">Consulta de tesoreria con filtros operativos y exportacion CSV</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchReportData} className="inline-flex items-center gap-2">
              <Filter size={16} /> Recargar
            </Button>
            <Button onClick={exportPagosCsv} className="inline-flex items-center gap-2">
              <Download size={16} /> Exportar Pagos CSV
            </Button>
            <Button variant="outline" onClick={exportPendientesCsv} className="inline-flex items-center gap-2">
              <FileText size={16} /> Exportar Pendientes CSV
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Desarrollo</label>
              <select
                value={desarrolloId}
                onChange={(e) => setDesarrolloId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
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
            <p className="text-2xl font-bold text-gray-900">{clientesPendientes}</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Pagos registrados</h2>
          <DataTable<PagoRow>
            data={pagosFiltrados}
            loading={loading}
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
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Pendientes de cobro (quien debe y cuanto)</h2>
          <DataTable<PendingRow>
            data={pendientesFiltrados}
            loading={loading}
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
        </div>
      </div>
    </AdminLayout>
  )
}
