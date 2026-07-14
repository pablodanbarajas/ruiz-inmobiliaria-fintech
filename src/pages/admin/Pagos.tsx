import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached, invalidateCache, onFocusRefetch } from '@/lib/queryCache'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PagoForm } from '@/components/forms/PagoForm'
import type { PagoFormData } from '@/components/forms/PagoForm'
import { Eye, ChevronLeft, ChevronRight, Plus, Download, Filter, ChevronDown, Receipt, Clock, BarChart3, Users, Calendar, Building2, Printer } from 'lucide-react'
import { ReciboPago } from '@/components/ReciboPago'
import type { ReciboPagoData } from '@/components/ReciboPago'
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
  calcularRecargo,
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
  cuenta_bancaria?: {
    cuenta_bancaria_id: number
    nombre: string
    banco: string | null
    numero_cuenta: string | null
    clabe: string | null
  } | null
}

type PendingRow = {
  clienteid: number
  clienteNombre: string
  desarrolloid: number | null
  ventaid: number
  corridafinancieraid: number
  fecha: string | null
  mensualidad: number
  montoPendiente: number
}

type CorteCobradorRow = {
  cobrador: string
  pagos: number
  monto: number
  aplicado: number
}

type ConciliacionDiariaRow = {
  fecha: string
  pagos: number
  monto: number
  aplicado: number
  diferenciaAjustes: number
}

type CorteCtaBancariaRow = {
  cuentaId: number | null
  cuentaNombre: string
  banco: string
  pagos: number
  monto: number
  aplicado: number
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
  const extra = pago.servicios_extra || 0
  return monto + extra
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
  const [activeTab, setActiveTab] = useState<'pagos' | 'pendientes' | 'reportes'>('pagos')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [reciboData, setReciboData] = useState<ReciboPagoData | null>(null)
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set())
  const [showDifModal, setShowDifModal] = useState(false)

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

  const fetchPagosAndPendientes = async (bypassCache = false) => {
    const CACHE_KEY = 'pagos:all'
    if (!bypassCache) {
      const cached = getCached<{ pagos: PagoWithDetails[]; pendientes: PendingRow[]; desarrollos: Desarrollo[] }>(CACHE_KEY)
      if (cached) {
        setAllPagos(cached.pagos)
        setPendientes(cached.pendientes)
        setDesarrollos(cached.desarrollos)
        setLoading(false)
        return
      }
    }
    try {
      setLoading(true)

      const todayStr = new Date().toISOString().split('T')[0]

      // Pre-fetch ventaIds for DEMO developments — query lote and venta directly
      // (avoids relying on nested joins that can be blocked by RLS)
      let demoVentaIds: number[] | null = null
      if (DEMO_DESARROLLOIDS.length > 0) {
        const { data: lotesData } = await supabase
          .from('lote')
          .select('loteid')
          .in('desarrolloid', DEMO_DESARROLLOIDS)

        const loteIds = (lotesData || []).map((l: any) => l.loteid as number)

        if (loteIds.length > 0) {
          const { data: ventasData } = await supabase
            .from('venta')
            .select('ventaid')
            .eq('estatus', 'A')
            .in('loteid', loteIds)
            .limit(5000)
          demoVentaIds = (ventasData || []).map((v: any) => v.ventaid as number)
        } else {
          demoVentaIds = []
        }
      }
      let corridasQuery = supabase
        .from('corridafinanciera')
        .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad, venta:venta!inner(ventaid, estatus, dias_tolerancia, cliente:cliente(clienteid, nombre), lote:lote(loteid, desarrolloid, desarrollo:desarrollo(desarrolloid, nombre))), pagos:pagos(pagoid, montopagado, servicios_extra, estatus, recargo)')
        .gt('nopago', 0)
        .lt('fecha', todayStr)
        .limit(5000)

      if (demoVentaIds !== null) {
        corridasQuery = demoVentaIds.length > 0
          ? corridasQuery.in('ventaid', demoVentaIds)
          : corridasQuery.eq('ventaid', -1) // no results if no matching ventas
      }

      const [pagosRes, corridasRes, desarrollosRes] = await Promise.all([
        supabase
          .from('pagos')
          .select('pagoid, fechapago, montopagado, servicios_extra, formapago, cobrador, estatus, corridafinancieraid, cuenta_bancaria_id, referencia, comentario, recargo, corridafinanciera:corridafinanciera(corridafinancieraid, venta:venta(ventaid, clienteid, cliente:cliente(clienteid, nombre), lote:lote(loteid, desarrolloid, manzana, nolote, desarrollo:desarrollo(desarrolloid, nombre)))), cuenta_bancaria:cuentas_bancarias(cuenta_bancaria_id, nombre, banco, numero_cuenta, clabe)')
          .order('fechapago', { ascending: false })
          .limit(10000),
        corridasQuery,
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
        const venta = pickFirst(corrida.venta) as any
        if (venta?.estatus !== 'A') continue

        // Use embedded pagos — avoids the 10k-row global pagos limit issue
        const pagosCorrida = ((corrida.pagos || []) as any[]).filter((p: any) => p.estatus !== 'C')
        const totalPagado = pagosCorrida.reduce((sum: number, p: any) => sum + getPagoAplicado(p as any), 0)

        const diasTolVenta = venta?.dias_tolerancia ?? 0
        const maxStoredRecargo = pagosCorrida.reduce((max: number, p: any) => Math.max(max, Number(p.recargo ?? 0)), 0)
        const recargoReq = pagosCorrida.length > 0
          ? maxStoredRecargo
          : (corrida.nopago !== 0 && corrida.fecha ? calcularRecargo(corrida.fecha, todayStr, diasTolVenta) : 0)

        const pendiente = Math.max(0, Number(corrida.mensualidad || 0) + recargoReq - totalPagado)
        if (pendiente <= 0) continue

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
          corridafinancieraid: corrida.corridafinancieraid,
          fecha: corrida.fecha || null,
          mensualidad: Number(corrida.mensualidad || 0),
          montoPendiente: pendiente,
        })
      }

      setPendientes(pendingRows)
      setCached('pagos:all', { pagos: pagosRows, pendientes: pendingRows, desarrollos: desarrollosRes.data as Desarrollo[] })
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
    // Re-fetch if user returns after 10+ min away (datos financieros críticos)
    return onFocusRefetch(() => fetchPagosAndPendientes(true), 'pagos:', 10 * 60 * 1000)
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
    const byClient = new Map<number, { clienteNombre: string; totalPendiente: number; corridasPendientes: number; corridas: PendingRow[] }>()

    for (const pending of filteredPendientes) {
      const current = byClient.get(pending.clienteid)
      if (current) {
        current.totalPendiente += pending.montoPendiente
        current.corridasPendientes += 1
        current.corridas.push(pending)
      } else {
        byClient.set(pending.clienteid, {
          clienteNombre: pending.clienteNombre,
          totalPendiente: pending.montoPendiente,
          corridasPendientes: 1,
          corridas: [pending],
        })
      }
    }

    return Array.from(byClient.entries())
      .map(([clienteid, v]) => ({ clienteid, ...v }))
      .sort((a, b) => b.totalPendiente - a.totalPendiente)
  }, [filteredPendientes])

  const totalItems = filteredPagos.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const pagos = filteredPagos.slice(startIndex, endIndex)

  // totalCobrado = efectivo realmente recibido (mensualidad + servicios extras cobrados en positivo)
  // totalAplicado = total aplicado a la cuenta del cliente (incluyendo saldos a favor negativos)
  // Diferencia = saldos a favor aplicados (solo aparece cuando servicios_extra < 0)
  const totalCobrado = filteredPagos.reduce((sum, p) => {
    const extra = Number(p.servicios_extra || 0)
    return sum + Number(p.montopagado || 0) + Math.max(0, extra)
  }, 0)
  const totalAplicado = filteredPagos.reduce((sum, p) => sum + getPagoAplicado(p), 0)

  // Paginated data for current page
  const filteredPagosForPagination = pagos

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

  const cortePorCobrador = useMemo<CorteCobradorRow[]>(() => {
    const map = new Map<string, CorteCobradorRow>()

    for (const pago of filteredPagos) {
      const key = (pago.cobrador || 'Sin cobrador').trim() || 'Sin cobrador'
      const current = map.get(key)
      const monto = Number(pago.montopagado || 0)
      const aplicado = getPagoAplicado(pago)

      if (current) {
        current.pagos += 1
        current.monto += monto
        current.aplicado += aplicado
      } else {
        map.set(key, {
          cobrador: key,
          pagos: 1,
          monto,
          aplicado,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.aplicado - a.aplicado)
  }, [filteredPagos])

  const conciliacionDiaria = useMemo<ConciliacionDiariaRow[]>(() => {
    const map = new Map<string, ConciliacionDiariaRow>()

    for (const pago of filteredPagos) {
      const fecha = pago.fechapago || 'Sin fecha'
      const current = map.get(fecha)
      const monto = Number(pago.montopagado || 0)
      const aplicado = getPagoAplicado(pago)

      if (current) {
        current.pagos += 1
        current.monto += monto
        current.aplicado += aplicado
        current.diferenciaAjustes += aplicado - monto
      } else {
        map.set(fecha, {
          fecha,
          pagos: 1,
          monto,
          aplicado,
          diferenciaAjustes: aplicado - monto,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.fecha === 'Sin fecha') return 1
      if (b.fecha === 'Sin fecha') return -1
      return a.fecha < b.fecha ? 1 : -1
    })
  }, [filteredPagos])

  const corteCtaBancaria = useMemo<CorteCtaBancariaRow[]>(() => {
    const map = new Map<string, CorteCtaBancariaRow>()

    for (const pago of filteredPagos) {
      if (pago.estatus === 'C') continue

      const cuentaBancaria = (pago.cuenta_bancaria as any) || null
      const key = cuentaBancaria ? String(cuentaBancaria.cuenta_bancaria_id) : 'SIN_CUENTA'
      const cuentaNombre = cuentaBancaria?.nombre || 'Sin especificar'
      const banco = cuentaBancaria?.banco || 'Efectivo/Otro'
      const monto = Number(pago.montopagado || 0)
      const aplicado = getPagoAplicado(pago)

      const current = map.get(key) || {
        cuentaId: cuentaBancaria?.cuenta_bancaria_id || null,
        cuentaNombre,
        banco,
        pagos: 0,
        monto: 0,
        aplicado: 0,
      }

      current.pagos += 1
      current.monto += monto
      current.aplicado += aplicado
      map.set(key, current)
    }

    return Array.from(map.values()).sort((a, b) => b.aplicado - a.aplicado)
  }, [filteredPagos])

  const exportCorteCobradorCsv = () => {
    const csv = toCsv(
      ['Cobrador', 'Pagos', 'Monto cobrado', 'Monto aplicado'],
      cortePorCobrador.map((row) => [row.cobrador, row.pagos, row.monto, row.aplicado])
    )

    downloadCsv(`tesoreria_corte_cobrador_${new Date().toISOString().split('T')[0]}.csv`, csv)
  }

  const exportConciliacionDiariaCsv = () => {
    const csv = toCsv(
      ['Fecha', 'Pagos', 'Monto cobrado', 'Monto aplicado', 'Diferencia ajustes'],
      conciliacionDiaria.map((row) => [row.fecha, row.pagos, row.monto, row.aplicado, row.diferenciaAjustes])
    )

    downloadCsv(`tesoreria_conciliacion_diaria_${new Date().toISOString().split('T')[0]}.csv`, csv)
  }

  const exportCorteCtaBancariaCsv = () => {
    const csv = toCsv(
      ['Cuenta Bancaria', 'Banco', 'Pagos', 'Monto cobrado', 'Monto aplicado'],
      corteCtaBancaria.map((row) => [row.cuentaNombre, row.banco, row.pagos, row.monto, row.aplicado])
    )

    downloadCsv(`tesoreria_corte_cuentas_bancarias_${new Date().toISOString().split('T')[0]}.csv`, csv)
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
                Tesoreria
              </h1>
              <p className="text-[#9e9f92] mt-2">Registro de pagos, análisis y reportes</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => { invalidateCache('pagos:'); fetchPagosAndPendientes(true) }} className="inline-flex items-center gap-2">
                <Filter size={16} /> Recargar
              </Button>
              
              {/* Export Dropdown */}
              <div className="relative">
                <Button 
                  variant="outline" 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center gap-2"
                >
                  <Download size={16} /> Exportar
                  <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </Button>
                
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    <button onClick={() => { exportPagosCsv(); setShowExportMenu(false) }} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2">
                      <BarChart3 size={16} /> Pagos Registrados
                    </button>
                    <button onClick={() => { exportPendientesCsv(); setShowExportMenu(false) }} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2">
                      <Clock size={16} /> Pendientes
                    </button>
                    <button onClick={() => { exportCorteCobradorCsv(); setShowExportMenu(false) }} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2">
                      <Users size={16} /> Corte por Cobrador
                    </button>
                    <button onClick={() => { exportConciliacionDiariaCsv(); setShowExportMenu(false) }} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2">
                      <Calendar size={16} /> Conciliación Diaria
                    </button>
                    <button onClick={() => { exportCorteCtaBancariaCsv(); setShowExportMenu(false) }} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 border-t">
                      <Building2 size={16} /> Por Cuentas Bancarias
                    </button>
                  </div>
                )}
              </div>

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

          {/* KPIs Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#eaae4c]">
              <p className="text-sm text-gray-500">Total cobrado</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCobrado)}</p>
              <p className="text-xs text-gray-400 mt-1">Suma de montopagado</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#504840]">
              <p className="text-sm text-gray-500">Total aplicado</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalAplicado)}</p>
              <p className="text-xs text-gray-400 mt-1">Cobrado ± servicios/ajustes</p>
            </div>
            <button
              className="bg-white rounded-lg shadow p-4 border-l-4 border-[#9e9f92] text-left hover:bg-gray-50 transition-colors"
              onClick={() => setShowDifModal(true)}
            >
              <p className="text-sm text-gray-500">Diferencia <span className="text-xs text-blue-500 ml-1">← ver detalle</span></p>
              <p className={`text-2xl font-bold ${totalCobrado - totalAplicado >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
                {formatCurrency(totalCobrado - totalAplicado)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Por servicios/ajustes aplicados</p>
            </button>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('pagos')}
                className={`pb-3 px-2 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'pagos'
                    ? 'text-[#eaae4c] border-b-2 border-[#eaae4c]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Receipt size={18} /> Pagos Registrados
              </button>
              <button
                onClick={() => setActiveTab('pendientes')}
                className={`pb-3 px-2 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'pendientes'
                    ? 'text-[#eaae4c] border-b-2 border-[#eaae4c]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock size={18} /> Pendientes ({pendingByClient.length})
              </button>
              <button
                onClick={() => setActiveTab('reportes')}
                className={`pb-3 px-2 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'reportes'
                    ? 'text-[#eaae4c] border-b-2 border-[#eaae4c]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 size={18} /> Reportes
              </button>
            </div>
          </div>

          {/* FILTERS - Show only in Pagos tab */}
          {activeTab === 'pagos' && (
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
                    placeholder="Buscar por nombre o telefono..."
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
                  <label className="block text-sm font-medium text-black mb-1">Metodo de cobranza</label>
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
          )}

          {/* TAB 1: PAGOS REGISTRADOS */}
          {activeTab === 'pagos' && (
            <>
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
                    key: 'lote',
                    label: 'Lote',
                    render: (row: PagoWithDetails) => {
                      const ctx = getPagoContext(row)
                      return ctx.lote ? `M${ctx.lote.manzana} L${ctx.lote.nolote}` : '-'
                    },
                  },
                  {
                    key: 'concepto',
                    label: 'Concepto',
                    render: (row: PagoWithDetails) => getPagoContext(row).venta?.ventaid ? 'Venta' : 'Otro',
                  },
                  {
                    key: 'fechapago',
                    label: 'Fecha de Pago',
                    render: (row: PagoWithDetails) => formatDate(row.fechapago),
                  },
                  {
                    key: 'metodo',
                    label: 'Metodo',
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
                    render: (row: PagoWithDetails) => {
                      const ctx = getPagoContext(row)
                      return (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/pagos/${row.pagoid}`)}
                            className="inline-flex items-center gap-1"
                          >
                            <Eye size={16} />
                            Ver
                          </Button>
                          {row.estatus === 'P' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReciboData({
                                pagoid: row.pagoid,
                                montopagado: row.montopagado,
                                servicios_extra: row.servicios_extra,
                                recargo: row.recargo,
                                fechapago: row.fechapago,
                                formapago: row.formapago,
                                estatus: row.estatus,
                                referencia: row.referencia,
                                cobrador: row.cobrador,
                                comentario: row.comentario,
                                corridafinancieraid: row.corridafinancieraid,
                                nopago: row.corridafinanciera?.nopago,
                                mensualidad: row.corridafinanciera?.mensualidad,
                                saldo: row.corridafinanciera?.saldo,
                                ventaid: ctx.venta?.ventaid,
                                preciolote: ctx.venta?.preciolote,
                                fechaventa: ctx.venta?.fecha,
                                clienteNombre: ctx.cliente?.nombre,
                                clienteEmail: ctx.cliente?.email,
                                clienteTelefono: (ctx.cliente as any)?.telefono,
                                manzana: ctx.lote?.manzana,
                                nolote: ctx.lote?.nolote,
                                desarrollo: ctx.desarrollo?.nombre,
                              })}
                              className="inline-flex items-center gap-1 text-[#504840] hover:text-[#3d3630]"
                            >
                              <Printer size={15} />
                              Recibo
                            </Button>
                          )}
                        </div>
                      )
                    },
                  },
                ]}
                data={filteredPagosForPagination}
                loading={loading}
              />

              {/* Pagination Controls */}
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
                  Pagina {totalItems === 0 ? 0 : currentPage} de {totalItems === 0 ? 0 : totalPages}
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
            </>
          )}

          {/* TAB 2: PENDIENTES */}
          {activeTab === 'pendientes' && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">Clientes con cartera pendiente</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Mensualidades vencidas sin pago completo · haz clic en una fila para ver el detalle</p>
                </div>
                {pendingByClient.length > 0 && (
                  <span className="text-sm font-semibold text-orange-700">
                    Total: {formatCurrency(pendingByClient.reduce((s, r) => s + r.totalPendiente, 0))}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="py-10 text-center text-gray-500">Cargando...</div>
              ) : pendingByClient.length === 0 ? (
                <div className="py-10 text-center text-gray-500">No hay cartera pendiente con los filtros actuales.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 w-8" />
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Corridas vencidas</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Total pendiente</th>
                        <th className="px-4 py-3 w-32" />
                      </tr>
                    </thead>
                    <tbody>
                      {pendingByClient.map((row) => {
                        const isExpanded = expandedClients.has(row.clienteid)
                        const toggle = () => setExpandedClients(prev => {
                          const next = new Set(prev)
                          if (next.has(row.clienteid)) next.delete(row.clienteid)
                          else next.add(row.clienteid)
                          return next
                        })
                        // Group corridas by ventaid for better display
                        const byVenta = row.corridas.reduce((acc, c) => {
                          if (!acc[c.ventaid]) acc[c.ventaid] = []
                          acc[c.ventaid].push(c)
                          return acc
                        }, {} as Record<number, PendingRow[]>)

                        return (
                          <>
                            <tr
                              key={row.clienteid}
                              className="hover:bg-amber-50 cursor-pointer border-t border-gray-100 transition-colors"
                              onClick={toggle}
                            >
                              <td className="px-4 py-3 text-gray-400">
                                <ChevronDown size={15} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">{row.clienteNombre}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.corridasPendientes}</td>
                              <td className="px-4 py-3 text-right font-bold text-orange-700">{formatCurrency(row.totalPendiente)}</td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/ventas/${row.corridas[0]?.ventaid}`) }}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  Ver venta →
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${row.clienteid}-detail`} className="bg-orange-50 border-t border-orange-100">
                                <td colSpan={5} className="px-0 py-0">
                                  <div className="px-8 py-3">
                                    {Object.entries(byVenta).map(([ventaid, corridas]) => (
                                      <div key={ventaid} className="mb-3">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-semibold text-gray-500 uppercase">Venta #{ventaid}</span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => navigate(`/admin/ventas/${ventaid}`)}
                                            className="text-xs text-blue-600 py-0 h-auto"
                                          >
                                            Ir a venta y registrar pago →
                                          </Button>
                                        </div>
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="text-gray-400 border-b border-orange-200">
                                              <th className="text-left py-1">Fecha vencida</th>
                                              <th className="text-right py-1">Mensualidad</th>
                                              <th className="text-right py-1">Pendiente</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {corridas.sort((a, b) => (a.fecha || '') < (b.fecha || '') ? -1 : 1).map((c) => (
                                              <tr key={c.corridafinancieraid} className="border-b border-orange-100">
                                                <td className="py-1 text-gray-700">{formatDate(c.fecha)}</td>
                                                <td className="py-1 text-right text-gray-700">{formatCurrency(c.mensualidad)}</td>
                                                <td className="py-1 text-right font-semibold text-orange-700">{formatCurrency(c.montoPendiente)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REPORTES */}
          {activeTab === 'reportes' && (
            <>
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">Corte por cuenta bancaria</h2>
                </div>
                {loading ? (
                  <div className="py-10 text-center text-gray-500">Cargando...</div>
                ) : corteCtaBancaria.length === 0 ? (
                  <div className="py-10 text-center text-gray-500">No hay datos de cuentas con los filtros actuales.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[620px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Cuenta / Banco</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Pagos</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Cobrado</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Aplicado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {corteCtaBancaria.map((row, idx) => (
                          <tr key={`${row.cuentaId}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-900">{row.cuentaNombre}</span>
                              <div className="text-xs text-gray-500">{row.banco}</div>
                            </td>
                            <td className="px-4 py-3 text-right">{row.pagos}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(row.monto)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatCurrency(row.aplicado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Corte por cobrador</h2>
                  </div>
                  {loading ? (
                    <div className="py-10 text-center text-gray-500">Cargando...</div>
                  ) : cortePorCobrador.length === 0 ? (
                    <div className="py-10 text-center text-gray-500">No hay datos de corte con los filtros actuales.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Cobrador</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Pagos</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Cobrado</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Aplicado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cortePorCobrador.map((row) => (
                            <tr key={row.cobrador} className="hover:bg-gray-50">
                              <td className="px-4 py-3">{row.cobrador}</td>
                              <td className="px-4 py-3 text-right">{row.pagos}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(row.monto)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.aplicado)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Conciliacion diaria</h2>
                  </div>
                  {loading ? (
                    <div className="py-10 text-center text-gray-500">Cargando...</div>
                  ) : conciliacionDiaria.length === 0 ? (
                    <div className="py-10 text-center text-gray-500">No hay datos de conciliacion con los filtros actuales.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[620px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Pagos</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Cobrado</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Aplicado</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Ajustes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {conciliacionDiaria.map((row) => (
                            <tr key={row.fecha} className="hover:bg-gray-50">
                              <td className="px-4 py-3">{row.fecha === 'Sin fecha' ? row.fecha : formatDate(row.fecha)}</td>
                              <td className="px-4 py-3 text-right">{row.pagos}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(row.monto)}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(row.aplicado)}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${row.diferenciaAjustes >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
                                {formatCurrency(row.diferenciaAjustes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
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

      {/* ── Modal: Recibo de Pago ─────────────────────── */}
      {reciboData && (
        <ReciboPago
          isOpen={!!reciboData}
          onClose={() => setReciboData(null)}
          data={reciboData}
        />
      )}

      {/* ── Modal: Detalle de Diferencia ──────────────── */}
      <Modal
        isOpen={showDifModal}
        title="Detalle de la Diferencia"
        onClose={() => setShowDifModal(false)}
        size="xl"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p><strong>Total cobrado</strong> = efectivo recibido en caja (<code>montopagado</code> + servicios cobrados en positivo).</p>
            <p className="mt-1"><strong>Total aplicado</strong> = lo que se aplicó a la cuenta del cliente (<code>montopagado + servicios_extra</code>).</p>
            <p className="mt-1"><strong>Diferencia</strong> = Cobrado − Aplicado. Solo es negativa cuando hay <strong>saldos a favor</strong> aplicados (servicios_extra negativo) — indica créditos usados sin cobro en efectivo.</p>
          </div>
          {(() => {
            const conAjuste = filteredPagos.filter(p => p.servicios_extra && p.servicios_extra !== 0)
            if (conAjuste.length === 0) return <p className="text-gray-400 text-center py-4">No hay ajustes en los pagos del filtro actual.</p>
            const cargos = conAjuste.filter(p => (p.servicios_extra || 0) > 0)
            const creditos = conAjuste.filter(p => (p.servicios_extra || 0) < 0)
            return (
              <div className="space-y-4">
                {creditos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-indigo-600 mb-2">Saldo a favor aplicado ({creditos.length})</p>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2">Pago ID</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-left px-3 py-2">Fecha</th>
                          <th className="text-right px-3 py-2">Aplicado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {creditos.map(p => {
                          const ctx = getPagoContext(p)
                          return (
                            <tr key={p.pagoid} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <button className="text-blue-600 hover:underline" onClick={() => { navigate(`/admin/pagos/${p.pagoid}`); setShowDifModal(false) }}>
                                  #{p.pagoid}
                                </button>
                              </td>
                              <td className="px-3 py-2">{ctx.cliente?.nombre || '—'}</td>
                              <td className="px-3 py-2">{formatDate(p.fechapago)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-indigo-600">{formatCurrency(p.servicios_extra)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {cargos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-purple-600 mb-2">Cargos adicionales ({cargos.length})</p>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2">Pago ID</th>
                          <th className="text-left px-3 py-2">Cliente</th>
                          <th className="text-left px-3 py-2">Fecha</th>
                          <th className="text-right px-3 py-2">Cargo extra</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cargos.map(p => {
                          const ctx = getPagoContext(p)
                          return (
                            <tr key={p.pagoid} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <button className="text-blue-600 hover:underline" onClick={() => { navigate(`/admin/pagos/${p.pagoid}`); setShowDifModal(false) }}>
                                  #{p.pagoid}
                                </button>
                              </td>
                              <td className="px-3 py-2">{ctx.cliente?.nombre || '—'}</td>
                              <td className="px-3 py-2">{formatDate(p.fechapago)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-purple-600">+{formatCurrency(p.servicios_extra)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between text-sm font-semibold">
                  <span className="text-gray-600">Total diferencia</span>
                  <span className={totalCobrado - totalAplicado >= 0 ? 'text-green-700' : 'text-orange-700'}>
                    {formatCurrency(totalCobrado - totalAplicado)}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      </Modal>
    </>
  )
}
