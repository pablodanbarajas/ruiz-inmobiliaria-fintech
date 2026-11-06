import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, MapPin, ShoppingCart, DollarSign, AlertTriangle, CheckCircle2,
  Home, Plus, CreditCard, UserPlus, ArrowLeftRight, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached, invalidateCache, onFocusRefetch } from '@/lib/queryCache'
import { fetchAllByKey } from '@/lib/fetchAllByKey'
import { fetchPanteonesDesarrolloIds } from '@/lib/panteones'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { formatCurrency, formatDate, getEspacioLabel, getVentaStatusLabel, getVentaStatusColor, calcularRecargo } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES, ROLE_LABELS, type AdminPanelRole } from '@/config/roles'
import { Skeleton } from '@/components/ui/Skeleton'

interface VentaEnRiesgo {
  ventaid: number
  clienteNombre: string
  loteLabel: string
  corridasVencidas: number
}

interface Stats {
  totalClientes: number
  totalDesarrollos: number
  totalVentas: number
  totalPagado: number
  pagosDelMes: number
  ventasEsteMes: number
  lotesDisponibles: number
  ventasActivas: number
}

interface PanteonesStats {
  ventasUltimoMes: number
  totalCobradoMes: number
  clientes: number
}

interface PagoReciente {
  pagoid: number
  montopagado: number
  fecha: string
  clienteNombre: string
  loteLabel: string
  ventaid: number
}

interface VentaReciente {
  ventaid: number
  precio: number | null
  estatus: string
  clienteNombre: string
  loteLabel: string
}

const isOnOrAfterDate = (value: string | null | undefined, floorDateIso: string): boolean => {
  if (!value) return false
  const valueDate = new Date(value)
  const floorDate = new Date(floorDateIso)
  if (Number.isNaN(valueDate.getTime()) || Number.isNaN(floorDate.getTime())) return false
  return valueDate >= floorDate
}

const isWithinMonth = (value: string | null | undefined, monthStartIso: string, nextMonthStartIso: string): boolean => {
  if (!value) return false
  const valueDate = new Date(value)
  const monthStart = new Date(monthStartIso)
  const nextMonthStart = new Date(nextMonthStartIso)
  if (Number.isNaN(valueDate.getTime()) || Number.isNaN(monthStart.getTime()) || Number.isNaN(nextMonthStart.getTime())) return false
  return valueDate >= monthStart && valueDate < nextMonthStart
}

export const Dashboard = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    totalDesarrollos: 0,
    totalVentas: 0,
    totalPagado: 0,
    pagosDelMes: 0,
    ventasEsteMes: 0,
    lotesDisponibles: 0,
    ventasActivas: 0,
  })
  const [loading, setLoading] = useState(true)
  const [ventasEnRiesgo, setVentasEnRiesgo] = useState<VentaEnRiesgo[]>([])
  const [loadingRiesgo, setLoadingRiesgo] = useState(true)
  const [totalCarteraVencida, setTotalCarteraVencida] = useState(0)
  const [pagosRecientes, setPagosRecientes] = useState<PagoReciente[]>([])
  const [ventasRecientes, setVentasRecientes] = useState<VentaReciente[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [panteonesStats, setPanteonesStats] = useState<PanteonesStats>({
    ventasUltimoMes: 0,
    totalCobradoMes: 0,
    clientes: 0,
  })
  const [loadingPanteonesStats, setLoadingPanteonesStats] = useState(true)

  const [ventasPendientesFormalizacion, setVentasPendientesFormalizacion] = useState<
    { ventaid: number; clienteNombre: string; loteLabel: string; fechaEnganche: string | null }[]
  >([])

  const currentRole = role && role in ROLE_CAPABILITIES ? (role as AdminPanelRole) : null
  const capabilities = currentRole ? ROLE_CAPABILITIES[currentRole] : null

  // vendedor_externo has no useful content on the dashboard — redirect immediately
  useEffect(() => {
    if (role === 'vendedor_externo') {
      navigate('/admin/ventas-externas', { replace: true })
    }
  }, [role, navigate])

  const canViewClientes = !!capabilities?.editar_clientes && role !== 'vendedor_externo'
  const canViewDesarrollos = !!capabilities?.ver_desarrollos
  const canViewLotes = !!capabilities?.ver_lotes
  const canViewVentas = !!capabilities?.editar_ventas
  const canViewPagos = !!capabilities?.consultar_pagos || !!capabilities?.registrar_pagos
  const canViewRiesgo = canViewVentas
  const canUseMapa = currentRole === 'admin'
  const canUseTraspasos = currentRole === 'admin'
  const canCreateCliente = !!capabilities?.editar_clientes && role !== 'vendedor_externo'
  const canCreateVenta = !!capabilities?.editar_ventas
  const canCreatePago = !!capabilities?.registrar_pagos

  useEffect(() => {
    const fetchStats = async () => {
      const ck = 'dashboard:stats'
      const cached = getCached<Stats>(ck)
      if (cached) {
        // Show cached values immediately, but still revalidate in background
        setStats(cached)
        setLoading(false)
      }
      try {
        const now = new Date()
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const firstOfNextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const firstOfNextMonth = `${firstOfNextMonthDate.getFullYear()}-${String(firstOfNextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

        if (DEMO_DESARROLLOIDS.length > 0) {
          // General figures cover Inmobiliaria Ruiz only; cemeteries have their own panel.
          const panteonesIds = await fetchPanteonesDesarrolloIds()
          const ruizIds = DEMO_DESARROLLOIDS.filter((id) => !panteonesIds.includes(id))

          // Filtered on the server and paged: the API returns at most 1000 rows per request.
          const [lotesDemo, ventasDemo, pagosDemo] = await Promise.all([
            fetchAllByKey<{ loteid: number; estatus: string | null }>(
              (afterKey, pageSize) =>
                supabase
                  .from('lote')
                  .select('loteid, estatus')
                  .in('desarrolloid', ruizIds)
                  .gt('loteid', afterKey)
                  .order('loteid', { ascending: true })
                  .limit(pageSize),
              (lote) => lote.loteid,
            ),
            fetchAllByKey<{ ventaid: number; clienteid: number | null; estatus: string | null; fecha: string | null }>(
              (afterKey, pageSize) =>
                supabase
                  .from('venta')
                  .select('ventaid, clienteid, estatus, fecha, lote:lote!inner(desarrolloid)')
                  .in('lote.desarrolloid', ruizIds)
                  .gt('ventaid', afterKey)
                  .order('ventaid', { ascending: true })
                  .limit(pageSize),
              (venta) => venta.ventaid,
            ),
            fetchAllByKey<{ pagoid: number; montopagado: number | null; servicios_extra: number | null; fechapago: string | null }>(
              (afterKey, pageSize) =>
                supabase
                  .from('pagos')
                  .select('pagoid, montopagado, servicios_extra, fechapago, corridafinanciera:corridafinanciera!inner(venta:venta!inner(lote:lote!inner(desarrolloid)))')
                  .in('corridafinanciera.venta.lote.desarrolloid', ruizIds)
                  .or('estatus.neq.C,estatus.is.null')
                  .gt('pagoid', afterKey)
                  .order('pagoid', { ascending: true })
                  .limit(pageSize),
              (pago) => pago.pagoid,
            ),
          ])

          const lotesDisponibles = lotesDemo.filter((l) => l.estatus === 'D').length
          const ventaIds = ventasDemo.map((v) => v.ventaid)
          const clienteIds = [...new Set(ventasDemo.map((v) => v.clienteid).filter(Boolean))]
          const ventasActivas = ventasDemo.filter((v) => v.estatus === 'A').length
          const ventasEsteMes = ventasDemo.filter((v) => {
            return v.estatus !== 'C' && isWithinMonth(v.fecha, firstOfMonth, firstOfNextMonth)
          }).length

          const getMontoCobrado = (p: { montopagado: number | null; servicios_extra: number | null }) =>
            Number(p.montopagado || 0) + Math.max(0, Number(p.servicios_extra || 0))
          const totalPagado = pagosDemo.reduce((sum, p) => sum + getMontoCobrado(p), 0)
          const pagosDelMes = pagosDemo
            .filter((p) => isWithinMonth(p.fechapago, firstOfMonth, firstOfNextMonth))
            .reduce((sum, p) => sum + getMontoCobrado(p), 0)

          setStats({
            totalClientes: clienteIds.length,
            totalDesarrollos: ruizIds.length,
            totalVentas: ventaIds.length,
            totalPagado,
            pagosDelMes,
            ventasEsteMes,
            lotesDisponibles,
            ventasActivas,
          })
          setCached('dashboard:stats', {
            totalClientes: clienteIds.length,
            totalDesarrollos: ruizIds.length,
            totalVentas: ventaIds.length,
            totalPagado,
            pagosDelMes,
            ventasEsteMes,
            lotesDisponibles,
            ventasActivas,
          })
        } else {
          const [clientesRes, desarrollosRes, ventasRes, pagosRes, lotesDisponiblesRes, ventasActivasRes, pagosDelMesRes, ventasEsteMesRes] = await Promise.all([
            supabase.from('cliente').select('*', { count: 'exact', head: true }),
            supabase.from('desarrollo').select('*', { count: 'exact', head: true }),
            supabase.from('venta').select('*', { count: 'exact', head: true }),
            supabase.from('pagos').select('montopagado').or('estatus.neq.C,estatus.is.null'),
            supabase.from('lote').select('*', { count: 'exact', head: true }).eq('estatus', 'D'),
            supabase.from('venta').select('*', { count: 'exact', head: true }).eq('estatus', 'A'),
            supabase.from('pagos').select('montopagado').gte('fechapago', firstOfMonth).or('estatus.neq.C,estatus.is.null'),
            supabase.from('venta').select('ventaid, fecha').limit(10000),
          ])

          if (clientesRes.error) throw clientesRes.error
          if (desarrollosRes.error) throw desarrollosRes.error
          if (ventasRes.error) throw ventasRes.error
          if (pagosRes.error) throw pagosRes.error
          if (lotesDisponiblesRes.error) throw lotesDisponiblesRes.error
          if (ventasActivasRes.error) throw ventasActivasRes.error
          if (pagosDelMesRes.error) throw pagosDelMesRes.error
          if (ventasEsteMesRes.error) throw ventasEsteMesRes.error

          const totalPagado = pagosRes.data?.reduce((sum, p) => sum + (p.montopagado || 0), 0) || 0
          const pagosDelMes = pagosDelMesRes.data?.reduce((sum, p) => sum + (p.montopagado || 0), 0) || 0
          const ventasEsteMes = (ventasEsteMesRes.data || []).filter((v: any) => {
            return isOnOrAfterDate(v.fecha, firstOfMonth)
          }).length

          setStats({
            totalClientes: clientesRes.count || 0,
            totalDesarrollos: desarrollosRes.count || 0,
            totalVentas: ventasRes.count || 0,
            totalPagado,
            pagosDelMes,
            ventasEsteMes,
            lotesDisponibles: lotesDisponiblesRes.count || 0,
            ventasActivas: ventasActivasRes.count || 0,
          })
          setCached('dashboard:stats', {
            totalClientes: clientesRes.count || 0,
            totalDesarrollos: desarrollosRes.count || 0,
            totalVentas: ventasRes.count || 0,
            totalPagado,
            pagosDelMes,
            ventasEsteMes,
            lotesDisponibles: lotesDisponiblesRes.count || 0,
            ventasActivas: ventasActivasRes.count || 0,
          })
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    return onFocusRefetch(() => { invalidateCache('dashboard:'); fetchStats() }, 'dashboard:stats', 10 * 60 * 1000)
  }, [])

  useEffect(() => {
    const fetchPanteonesStats = async () => {
      const cacheKey = 'dashboard:panteones'
      const cached = getCached<PanteonesStats>(cacheKey)
      if (cached) {
        setPanteonesStats(cached)
        setLoadingPanteonesStats(false)
      }

      try {
        const now = new Date()
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const firstOfNextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const firstOfNextMonth = `${firstOfNextMonthDate.getFullYear()}-${String(firstOfNextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

        const developmentIds = await fetchPanteonesDesarrolloIds()
        if (developmentIds.length === 0) {
          const emptyStats = { ventasUltimoMes: 0, totalCobradoMes: 0, clientes: 0 }
          setPanteonesStats(emptyStats)
          setCached(cacheKey, emptyStats)
          return
        }

        const [panteonesSales, payments] = await Promise.all([
          fetchAllByKey<{ ventaid: number; clienteid: number | null; estatus: string | null; fecha: string | null }>(
            (afterKey, pageSize) =>
              supabase
                .from('venta')
                .select('ventaid, clienteid, estatus, fecha, lote:lote!inner(desarrolloid)')
                .in('lote.desarrolloid', developmentIds)
                .gt('ventaid', afterKey)
                .order('ventaid', { ascending: true })
                .limit(pageSize),
            (sale) => sale.ventaid,
          ),
          fetchAllByKey<{ pagoid: number; montopagado: number | null; servicios_extra: number | null }>(
            (afterKey, pageSize) =>
              supabase
                .from('pagos')
                .select('pagoid, montopagado, servicios_extra, corridafinanciera:corridafinanciera!inner(venta:venta!inner(estatus, lote:lote!inner(desarrolloid)))')
                .in('corridafinanciera.venta.lote.desarrolloid', developmentIds)
                .not('corridafinanciera.venta.estatus', 'in', '(C,P)')
                .or('estatus.neq.C,estatus.is.null')
                .gte('fechapago', firstOfMonth)
                .lt('fechapago', firstOfNextMonth)
                .gt('pagoid', afterKey)
                .order('pagoid', { ascending: true })
                .limit(pageSize),
            (payment) => payment.pagoid,
          ),
        ])

        // A sale still waiting for its down payment (E) can expire, so it isn't confirmed yet.
        const confirmedSales = panteonesSales.filter(
          (sale) => sale.estatus === 'A' || sale.estatus === 'V'
        )
        const salesThisMonth = confirmedSales.filter((sale) =>
          isWithinMonth(sale.fecha, firstOfMonth, firstOfNextMonth)
        ).length
        const clientIds = new Set(
          confirmedSales.map((sale) => sale.clienteid).filter((clientId): clientId is number => Boolean(clientId))
        )

        const totalCobradoMes = payments.reduce(
          (total, payment) => total + (payment.montopagado || 0) + (payment.servicios_extra || 0),
          0
        )
        const nextStats = {
          ventasUltimoMes: salesThisMonth,
          totalCobradoMes,
          clientes: clientIds.size,
        }
        setPanteonesStats(nextStats)
        setCached(cacheKey, nextStats)
      } catch (error) {
        console.error('Error fetching Valle de Flores dashboard stats:', error)
      } finally {
        setLoadingPanteonesStats(false)
      }
    }

    fetchPanteonesStats()
    return onFocusRefetch(
      () => {
        invalidateCache('dashboard:panteones')
        fetchPanteonesStats()
      },
      'dashboard:panteones',
      10 * 60 * 1000
    )
  }, [])

  // ── Ventas en riesgo de cancelación ────────────────────────────
  useEffect(() => {
    if (!canViewRiesgo) {
      setVentasEnRiesgo([])
      setLoadingRiesgo(false)
      return
    }

    const fetchRiesgo = async () => {
      const ck = 'dashboard:riesgo'
      const cached = getCached<{ resultados: VentaEnRiesgo[]; totalCartera: number }>(ck)
      if (cached) { setVentasEnRiesgo(cached.resultados); setTotalCarteraVencida(cached.totalCartera); setLoadingRiesgo(false); return }
      try {
        setLoadingRiesgo(true)
        const today = new Date().toISOString().split('T')[0]

        // Pre-fetch ventaIds for DEMO developments (same fix as Pendientes tab)
        let demoVentaIds: number[] | null = null
        if (DEMO_DESARROLLOIDS.length > 0) {
          const panteonesIds = await fetchPanteonesDesarrolloIds()
          const { data: lotesData } = await supabase
            .from('lote').select('loteid').in('desarrolloid', DEMO_DESARROLLOIDS.filter((id) => !panteonesIds.includes(id)))
          const loteIds = (lotesData || []).map((l: any) => l.loteid as number)
          if (loteIds.length > 0) {
            const { data: ventasData } = await supabase
              .from('venta').select('ventaid').eq('estatus', 'A').in('loteid', loteIds).limit(5000)
            demoVentaIds = (ventasData || []).map((v: any) => v.ventaid as number)
          } else {
            demoVentaIds = []
          }
        }

        if (demoVentaIds !== null && demoVentaIds.length === 0) {
          setVentasEnRiesgo([])
          setLoadingRiesgo(false)
          return
        }

        let corridasQuery = supabase
          .from('corridafinanciera')
          .select('corridafinancieraid, ventaid, nopago, fecha, mensualidad, venta:venta!inner(estatus, clienteid, dias_tolerancia, cliente:cliente(nombre), lote:lote(manzana, nolote, clavelote, desarrolloid)), pagos:pagos(pagoid, montopagado, servicios_extra, estatus, recargo)')
          .lt('fecha', today)

        if (demoVentaIds) corridasQuery = corridasQuery.in('ventaid', demoVentaIds)

        // Paginate: a single .limit(5000) can silently truncate before
        // reaching some ventas when a demo development has many sales/installments
        const seenCorridaIds = new Set<number>()
        const corridasData: any[] = []
        const PAGE_SIZE = 1000
        let from = 0
        let pageErr: any = null
        while (true) {
          const { data, error } = await corridasQuery
            .order('ventaid', { ascending: true })
            .order('corridafinancieraid', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)
          if (error) { pageErr = error; break }
          if (!data || data.length === 0) break
          for (const row of data) {
            if (seenCorridaIds.has(row.corridafinancieraid)) continue
            seenCorridaIds.add(row.corridafinancieraid)
            corridasData.push(row)
          }
          if (data.length < PAGE_SIZE) break
          from += PAGE_SIZE
        }

        if (pageErr || !corridasData.length) { setTotalCarteraVencida(0); setLoadingRiesgo(false); return }


        // Only active ventas
        const corridasFiltradas = (corridasData as any[]).filter((c) => {
          const venta = Array.isArray(c.venta) ? c.venta[0] : c.venta
          return venta?.estatus === 'A'
        })

        if (!corridasFiltradas.length) { setVentasEnRiesgo([]); setTotalCarteraVencida(0); setLoadingRiesgo(false); return }

        // Group corridas by ventaid, count vencidas
        // Also sum total cartera vencida (all unpaid, not just 3+)
        // Same math as Tesorería → Pendientes: skip enganches (nopago===0) and add recargos
        let totalCartera = 0
        const ventaMap = new Map<number, { venta: any; vencidas: number }>()
        for (const c of corridasFiltradas) {
          if (c.nopago === 0) continue

          const venta = Array.isArray(c.venta) ? c.venta[0] : c.venta
          const pagosCorrida = ((c.pagos || []) as any[]).filter((p) => p.estatus !== 'C')
          const pagado = pagosCorrida.reduce((sum, p) => sum + (p.montopagado || 0) + Math.max(0, p.servicios_extra || 0), 0)

          const diasTolVenta = venta?.dias_tolerancia ?? 0
          const maxStoredRecargo = pagosCorrida.reduce((max, p) => Math.max(max, Number(p.recargo ?? 0)), 0)
          const recargoReq = pagosCorrida.length > 0
            ? maxStoredRecargo
            : (c.fecha ? calcularRecargo(c.fecha, today, diasTolVenta) : 0)

          const pendiente = Math.max(0, (c.mensualidad || 0) + recargoReq - pagado)
          if (pendiente <= 0) continue  // ya pagada
          totalCartera += pendiente

          const entry = ventaMap.get(c.ventaid)
          if (entry) {
            entry.vencidas++
          } else {
            ventaMap.set(c.ventaid, { venta, vencidas: 1 })
          }
        }

        // Filter ventas con >= 3 vencidas
        const ventasConRiesgo = Array.from(ventaMap.entries())
          .filter(([, v]) => v.vencidas >= 3)
          .map(([ventaid, v]) => ({ ventaid, ...v }))

        if (!ventasConRiesgo.length) {
          setVentasEnRiesgo([])
          setTotalCarteraVencida(totalCartera)
          setCached('dashboard:riesgo', { resultados: [], totalCartera })
          setLoadingRiesgo(false)
          return
        }

        // Build result
        const resultados: VentaEnRiesgo[] = ventasConRiesgo.map(({ ventaid, venta, vencidas }) => {
          return {
            ventaid,
            clienteNombre: venta?.cliente?.nombre ?? 'Sin nombre',
            loteLabel: getEspacioLabel(venta?.lote) ?? `Mza ${venta?.lote?.manzana ?? '-'} / ${venta?.lote?.nolote ?? '-'}`,
            corridasVencidas: vencidas,
          }
        })

        resultados.sort((a, b) => b.corridasVencidas - a.corridasVencidas)
        setCached('dashboard:riesgo', { resultados, totalCartera })
        setVentasEnRiesgo(resultados)
        setTotalCarteraVencida(totalCartera)
      } catch (err) {
        console.error('Error fetching ventas en riesgo:', err)
      } finally {
        setLoadingRiesgo(false)
      }
    }

    fetchRiesgo()
  }, [canViewRiesgo])

  // ── Actividad reciente ──────────────────────────────────────────
  useEffect(() => {
    if (!canViewPagos && !canViewVentas) {
      setPagosRecientes([])
      setVentasRecientes([])
      setLoadingRecent(false)
      return
    }

    const fetchRecent = async () => {
      const ck_pagos = 'dashboard:pagos_recientes'
      const ck_ventas = 'dashboard:ventas_recientes'
      const cp = getCached<PagoReciente[]>(ck_pagos)
      const cv = getCached<VentaReciente[]>(ck_ventas)
      if (cp && cv) { setPagosRecientes(cp); setVentasRecientes(cv); setLoadingRecent(false); return }
      try {
        setLoadingRecent(true)

        if (canViewVentas) {
          // Ultimas ventas
          const { data: vData } = await supabase
            .from('venta')
            .select('ventaid, preciolote, estatus, clienteid, loteid')
            .order('ventaid', { ascending: false })
            .limit(30)

          if (vData && vData.length > 0) {
            const loteIds = [...new Set((vData as any[]).map((v) => v.loteid).filter(Boolean))]
            const clienteIds = [...new Set((vData as any[]).map((v) => v.clienteid).filter(Boolean))]
            const [{ data: lotesData }, { data: clientesData }] = await Promise.all([
              supabase.from('lote').select('loteid, manzana, nolote, clavelote, desarrolloid').in('loteid', loteIds),
              supabase.from('cliente').select('clienteid, nombre').in('clienteid', clienteIds),
            ])
            const loteMap = new Map((lotesData || []).map((l: any) => [l.loteid, l]))
            const clienteMap = new Map((clientesData || []).map((c: any) => [c.clienteid, c]))

            const ventasFiltradas = DEMO_DESARROLLOIDS.length > 0
              ? (vData as any[]).filter((v) => DEMO_DESARROLLOIDS.includes(loteMap.get(v.loteid)?.desarrolloid))
              : (vData as any[])

            const list = ventasFiltradas.slice(0, 6).map((v: any) => {
                const lote = loteMap.get(v.loteid)
                const cliente = clienteMap.get(v.clienteid)
                return {
                  ventaid: v.ventaid,
                  precio: v.preciolote,
                  estatus: v.estatus,
                  clienteNombre: cliente?.nombre ?? `Cliente #${v.clienteid}`,
                  loteLabel: lote ? getEspacioLabel(lote) ?? `Mza ${lote.manzana} – L${lote.nolote}${lote.clavelote ? ` (${lote.clavelote})` : ''}` : '—',
                }
              })
            setCached('dashboard:ventas_recientes', list)
            setVentasRecientes(list)
          } else {
            setVentasRecientes([])
          }
        } else {
          setVentasRecientes([])
        }

        if (canViewPagos) {
          // Ultimos pagos — sin join embebido para evitar error 400 si no hay FK declarado
          const { data: pData } = await supabase
            .from('pagos')
            .select('pagoid, montopagado, fechapago, corridafinancieraid')
            .order('pagoid', { ascending: false })
            .limit(50)

          const corridaIds2 = [...new Set((pData || []).map((p: any) => p.corridafinancieraid).filter(Boolean))]
          const { data: corridasData2 } = corridaIds2.length > 0
            ? await supabase.from('corridafinanciera').select('corridafinancieraid, ventaid').in('corridafinancieraid', corridaIds2)
            : { data: [] }

          const corridaVentaMap = new Map<number, number>(
            (corridasData2 || []).map((c: any) => [c.corridafinancieraid, c.ventaid])
          )

          const pagosConVenta = (pData || []).filter((p: any) => corridaVentaMap.has(p.corridafinancieraid))
          const ventaIds = [...new Set(pagosConVenta.map((p: any) => corridaVentaMap.get(p.corridafinancieraid) as number))]

          if (ventaIds.length > 0) {
            const { data: ventasData } = await supabase
              .from('venta')
              .select('ventaid, clienteid, loteid')
              .in('ventaid', ventaIds as number[])

            const ventaLoteIds = [...new Set((ventasData || []).map((v: any) => v.loteid).filter(Boolean))]
            const ventaClienteIds = [...new Set((ventasData || []).map((v: any) => v.clienteid).filter(Boolean))]
            const [{ data: vLotesData }, { data: vClientesData }] = await Promise.all([
              supabase.from('lote').select('loteid, manzana, nolote, clavelote, desarrolloid').in('loteid', ventaLoteIds),
              supabase.from('cliente').select('clienteid, nombre').in('clienteid', ventaClienteIds),
            ])
            const vLoteMap = new Map((vLotesData || []).map((l: any) => [l.loteid, l]))
            const vClienteMap = new Map((vClientesData || []).map((c: any) => [c.clienteid, c]))

            const ventaMap = new Map<number, any>()
            for (const v of ventasData || []) ventaMap.set((v as any).ventaid, v)

            const pagosList: PagoReciente[] = []
            for (const p of pagosConVenta) {
              const ventaid = corridaVentaMap.get(p.corridafinancieraid) as number
              const venta = ventaMap.get(ventaid)
              if (!venta) continue
              const lote = vLoteMap.get(venta.loteid)
              if (DEMO_DESARROLLOIDS.length > 0 && !DEMO_DESARROLLOIDS.includes(lote?.desarrolloid)) continue
              const cliente = vClienteMap.get(venta.clienteid)
              pagosList.push({
                pagoid: p.pagoid,
                montopagado: p.montopagado,
                fecha: p.fechapago,
                clienteNombre: cliente?.nombre ?? `Cliente #${venta.clienteid}`,
                loteLabel: lote ? getEspacioLabel(lote) ?? `Mza ${lote.manzana} – L${lote.nolote}` : '—',
                ventaid,
              })
              if (pagosList.length >= 6) break
            }
            setCached('dashboard:pagos_recientes', pagosList)
            setPagosRecientes(pagosList)
          } else {
            setPagosRecientes([])
          }
        } else {
          setPagosRecientes([])
        }
      } catch (err) {
        console.error('Error fetching recent activity:', err)
      } finally {
        setLoadingRecent(false)
      }
    }
    fetchRecent()
  }, [canViewPagos, canViewVentas])

  // ── Ventas pendientes de formalización (portal) ─────────────────
  useEffect(() => {
    if (!canViewVentas) return
    const fetch = async () => {
      // 1. Solo ventas activas originadas desde el portal (tienen fecha_reserva)
      const { data: ventas } = await supabase
        .from('venta')
        .select('ventaid, clienteid, loteid, fechaenganche, estatus')
        .eq('estatus', 'A')
        .not('fecha_reserva', 'is', null)
        .order('ventaid', { ascending: false })
        .limit(100)
      if (!ventas || ventas.length === 0) return

      // 2. Obtener ventaids que ya tienen corrida
      const { data: corridasData } = await supabase
        .from('corridafinanciera')
        .select('ventaid')
        .in('ventaid', (ventas as any[]).map((v) => v.ventaid))
      const ventaidConCorrida = new Set((corridasData || []).map((c: any) => c.ventaid))

      // 3. Filtrar ventas sin corrida
      const ventasSinCorrida = (ventas as any[]).filter((v) => !ventaidConCorrida.has(v.ventaid))
      if (ventasSinCorrida.length === 0) return

      const loteIds = [...new Set(ventasSinCorrida.map((v) => v.loteid).filter(Boolean))]
      const clienteIds = [...new Set(ventasSinCorrida.map((v) => v.clienteid).filter(Boolean))]
      const [{ data: lotesData }, { data: clientesData }] = await Promise.all([
        supabase.from('lote').select('loteid, manzana, nolote, clavelote').in('loteid', loteIds),
        supabase.from('cliente').select('clienteid, nombre').in('clienteid', clienteIds),
      ])
      const loteMap = new Map((lotesData || []).map((l: any) => [l.loteid, l]))
      const clienteMap = new Map((clientesData || []).map((c: any) => [c.clienteid, c]))

      setVentasPendientesFormalizacion(ventasSinCorrida.map((v) => {
        const lote = loteMap.get(v.loteid)
        const cliente = clienteMap.get(v.clienteid)
        return {
          ventaid: v.ventaid,
          clienteNombre: cliente?.nombre ?? `Cliente #${v.clienteid}`,
          loteLabel: lote?.clavelote ?? `Mza ${lote?.manzana}-Lote ${lote?.nolote}`,
          fechaEnganche: v.fechaenganche,
        }
      }))
    }
    fetch()
  }, [canViewVentas])

  const monthName = new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  const MiniStat = ({
    title,
    value,
    icon: Icon,
    color,
    onClick,
    className = '',
  }: {
    className?: string
    title: string
    value: string | number
    icon: React.ReactNode
    color: string
    onClick?: () => void
  }) => (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-[14px] border border-[#e0e5e7] bg-white transition-colors ${onClick ? 'cursor-pointer hover:bg-[#fffde1]' : ''} ${className}`}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
        {Icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-black leading-tight truncate">{value}</p>
        <p className="text-xs text-[#9e9f92] leading-tight truncate">{title}</p>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#63696c]">Resumen operativo</p>
            <h1 className="text-3xl md:text-4xl font-bold text-[#142127]" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
            <p className="text-[#63696c] mt-1 capitalize">{monthName}</p>
            {currentRole && (
              <p className="text-xs text-gray-500 mt-1">Vista de rol: {ROLE_LABELS[currentRole]}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Accesos rápidos</h2>
            <div className="flex flex-wrap justify-end gap-2">
              {[
                canCreateVenta ? { label: 'Nueva Venta', icon: <Plus size={16} />, path: '/admin/ventas?new=true' } : null,
                canCreatePago ? { label: 'Nuevo Pago', icon: <CreditCard size={16} />, path: '/admin/pagos?new=true' } : null,
                canCreateCliente ? { label: 'Nuevo Cliente', icon: <UserPlus size={16} />, path: '/admin/clientes?new=true' } : null,
                canUseTraspasos ? { label: 'Nuevo Traspaso', icon: <ArrowLeftRight size={16} />, path: '/admin/traspasos?new=true' } : null,
                canUseMapa ? { label: 'Ver Mapa', icon: <MapPin size={16} />, path: '/admin/mapa' } : null,
              ].filter(Boolean).map((item) => (
                <button
                  key={(item as { path: string }).path}
                  type="button"
                  onClick={() => navigate((item as { path: string }).path)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#c7d5d9] bg-white text-xs font-medium text-[#142127] hover:border-[#142127] hover:bg-[#fffde1] transition-all"
                >
                  {(item as { icon: React.ReactNode }).icon}
                  {(item as { label: string }).label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, panel) => (
              <div key={panel} className="rounded-[20px] border border-[#e0e5e7] bg-white p-5">
                <Skeleton className="mb-4 h-12 w-full rounded-t-[20px]" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: panel === 0 ? 6 : 2 }).map((__, item) => (
                    <div key={item} className="rounded-[14px] border border-[#e0e5e7] p-3">
                      <Skeleton className="mb-3 h-8 w-8 rounded-lg" />
                      <Skeleton className="mb-2 h-5 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-5 ${canViewVentas ? 'min-[1750px]:grid-cols-[2fr_1fr]' : ''}`}>
            <div className="flex flex-col gap-5">
              {/* ── KPIs generales (totales acumulados, no ligados al mes) ── */}
              <div className="bg-white rounded-[20px] border border-[#e0e5e7] p-5">
                <h2 className="-mx-5 -mt-5 mb-4 rounded-t-[20px] bg-[#142127] px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white">Inmobiliaria Ruiz · Totales</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {canViewPagos && (
                    <MiniStat
                      className="col-span-2"
                      title="Total pagado"
                      value={formatCurrency(stats.totalPagado)}
                      icon={<DollarSign className="w-5 h-5 text-white" />}
                      color="#16a34a"
                      onClick={() => navigate('/admin/pagos?unidad=ruiz')}
                    />
                  )}
                  {canViewClientes && (
                    <MiniStat
                      title="Clientes"
                      value={stats.totalClientes}
                      icon={<Users className="w-5 h-5 text-white" />}
                      color="#9e9f92"
                      onClick={() => navigate('/admin/clientes')}
                    />
                  )}
                  {canViewVentas && (
                    <MiniStat
                      title="Ventas activas"
                      value={stats.ventasActivas}
                      icon={<ShoppingCart className="w-5 h-5 text-black" />}
                      color="#16a34a"
                      onClick={() => navigate('/admin/ventas')}
                    />
                  )}
                  {canViewPagos && (
                    <MiniStat
                      title="Cartera vencida"
                      value={loadingRiesgo ? '…' : formatCurrency(totalCarteraVencida)}
                      icon={<DollarSign className="w-5 h-5 text-white" />}
                      color={totalCarteraVencida > 0 ? '#dc2626' : '#16a34a'}
                      onClick={() => navigate('/admin/pagos?tab=pendientes&unidad=ruiz')}
                    />
                  )}
                  {canViewLotes && (
                    <MiniStat
                      title="Lotes disponibles"
                      value={stats.lotesDisponibles}
                      icon={<Home className="w-5 h-5 text-white" />}
                      color="#9e9f92"
                      onClick={() => navigate('/admin/lotes')}
                    />
                  )}
                  {canViewDesarrollos && (
                    <MiniStat
                      title="Desarrollos"
                      value={stats.totalDesarrollos}
                      icon={<MapPin className="w-5 h-5 text-white" />}
                      color="#504840"
                      onClick={() => navigate('/admin/desarrollos')}
                    />
                  )}
                  {canViewRiesgo && (
                    <MiniStat
                      title="En riesgo de cancelación"
                      value={loadingRiesgo ? '…' : ventasEnRiesgo.length}
                      icon={<AlertTriangle className="w-5 h-5 text-white" />}
                      color="#dc2626"
                      onClick={() => navigate('/admin/pagos?tab=pendientes&unidad=ruiz')}
                    />
                  )}
                </div>
              </div>

              {/* ── KPIs del mes en curso ── */}
              {(canViewPagos || canViewVentas) && (
                <div className="flex-1 bg-white rounded-[20px] border border-[#e0e5e7] p-5">
                  <h2 className="-mx-5 -mt-5 mb-4 rounded-t-[20px] bg-[#142127] px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white capitalize">
                    Inmobiliaria Ruiz · Este mes · {monthName}
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {canViewPagos && (
                      <MiniStat
                        title="Cobrado este mes"
                        value={formatCurrency(stats.pagosDelMes)}
                        icon={<TrendingUp className="w-5 h-5 text-white" />}
                        color="#504840"
                        onClick={() => navigate('/admin/pagos?unidad=ruiz')}
                      />
                    )}
                    {canViewVentas && (
                      <MiniStat
                        title="Ventas nuevas este mes"
                        value={stats.ventasEsteMes}
                        icon={<ShoppingCart className="w-5 h-5 text-white" />}
                        color="#16a34a"
                        onClick={() => navigate('/admin/ventas')}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Valle de Flores: its own column, apart from the Ruiz figures ── */}
            {canViewVentas && (
              <div className="flex flex-col rounded-[20px] border border-[#e0e5e7] bg-white p-5">
                <h2 className="-mx-5 -mt-5 mb-4 rounded-t-[20px] bg-[#142127] px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  Valle de Flores · Panteones
                </h2>
                <div className="grid flex-1 grid-cols-1 gap-2 min-[1750px]:auto-rows-fr sm:max-[1749px]:grid-cols-3">
                  <MiniStat
                    title="Ventas del último mes"
                    value={loadingPanteonesStats ? '…' : panteonesStats.ventasUltimoMes}
                    icon={<ShoppingCart className="h-5 w-5 text-white" />}
                    color="#9e9f92"
                    onClick={() => navigate('/admin/ventas')}
                  />
                  <MiniStat
                    title="Total cobrado del mes"
                    value={loadingPanteonesStats ? '…' : formatCurrency(panteonesStats.totalCobradoMes)}
                    icon={<DollarSign className="h-5 w-5 text-white" />}
                    color="#504840"
                    onClick={() => navigate('/admin/pagos?unidad=valle')}
                  />
                  <MiniStat
                    title="Clientes"
                    value={loadingPanteonesStats ? '…' : panteonesStats.clientes}
                    icon={<Users className="h-5 w-5 text-white" />}
                    color="#9e9f92"
                    onClick={() => navigate('/admin/clientes')}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Actividad reciente ── */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Últimos pagos */}
          {canViewPagos && (
          <div className="bg-white rounded-[20px] border border-[#e0e5e7] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#253940] bg-[#142127] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-white" />
                <h3 className="text-sm font-semibold text-white">Últimos pagos registrados</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/pagos')}
                className="rounded-full border border-[#e0e5e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#142127] shadow-sm transition-colors hover:bg-[#f2f4f5]"
              >
                Ver todos
              </button>
            </div>
            {loadingRecent ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : pagosRecientes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin pagos recientes</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pagosRecientes.map((p) => (
                  <li
                    key={p.pagoid}
                    onClick={() => navigate(canViewVentas ? `/admin/ventas/${p.ventaid}` : `/admin/pagos/${p.pagoid}`)}
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.clienteNombre}</p>
                      <p className="text-xs text-gray-400">{p.loteLabel} · {formatDate(p.fecha)}</p>
                    </div>
                    <span className="ml-4 text-sm font-semibold text-green-700 whitespace-nowrap">
                      {formatCurrency(p.montopagado)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}

          {/* Últimas ventas */}
          {canViewVentas && (
          <div className="bg-white rounded-[20px] border border-[#e0e5e7] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#253940] bg-[#142127] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-white" />
                <h3 className="text-sm font-semibold text-white">Últimas ventas registradas</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/ventas')}
                className="rounded-full border border-[#e0e5e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#142127] shadow-sm transition-colors hover:bg-[#f2f4f5]"
              >
                Ver todas
              </button>
            </div>
            {loadingRecent ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : ventasRecientes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin ventas recientes</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {ventasRecientes.map((v) => (
                  <li
                    key={v.ventaid}
                    onClick={() => navigate(`/admin/ventas/${v.ventaid}`)}
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{v.clienteNombre}</p>
                      <p className="text-xs text-gray-400">{v.loteLabel}</p>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1">
                      {v.precio != null && (
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                          {formatCurrency(v.precio)}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getVentaStatusColor(v.estatus)}`}>
                        {getVentaStatusLabel(v.estatus)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </div>

        {/* ── Ventas pendientes de formalización (portal) ── */}
        {canViewVentas && ventasPendientesFormalizacion.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-green-600 w-5 h-5" />
              Pendientes de formalización (portal)
              <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {ventasPendientesFormalizacion.length}
              </span>
            </h2>
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Venta</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lote</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fecha Enganche</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ventasPendientesFormalizacion.map((v) => (
                    <tr key={v.ventaid} className="hover:bg-green-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">#{v.ventaid}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{v.clienteNombre}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{v.loteLabel}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{v.fechaEnganche ? formatDate(v.fechaEnganche) : '—'}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/ventas/${v.ventaid}`)}
                          className="inline-flex items-center gap-1 text-sm text-green-700 font-semibold hover:underline"
                        >
                          <CheckCircle2 size={14} />
                          Formalizar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
