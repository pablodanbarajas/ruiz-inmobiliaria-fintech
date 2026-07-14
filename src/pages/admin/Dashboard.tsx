import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, MapPin, ShoppingCart, DollarSign, AlertTriangle, Eye, CheckCircle2,
  Home, Plus, CreditCard, UserPlus, ArrowLeftRight, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached, invalidateCache, onFocusRefetch } from '@/lib/queryCache'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { formatCurrency, formatDate, getVentaStatusLabel, getVentaStatusColor } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES, ROLE_LABELS, type AdminPanelRole } from '@/config/roles'

interface VentaEnRiesgo {
  ventaid: number
  clienteNombre: string
  loteLabel: string
  corridasVencidas: number
  ultimoAviso: string | null
  etapa: string
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

  const [ventasPendientesFormalizacion, setVentasPendientesFormalizacion] = useState<
    { ventaid: number; clienteNombre: string; loteLabel: string; fechaEnganche: string | null }[]
  >([])

  const currentRole = role && role in ROLE_CAPABILITIES ? (role as AdminPanelRole) : null
  const capabilities = currentRole ? ROLE_CAPABILITIES[currentRole] : null

  const canViewClientes = !!capabilities?.editar_clientes
  const canViewDesarrollos = !!capabilities?.ver_desarrollos
  const canViewLotes = !!capabilities?.ver_lotes
  const canViewVentas = !!capabilities?.editar_ventas
  const canViewPagos = !!capabilities?.consultar_pagos || !!capabilities?.registrar_pagos
  const canViewRiesgo = canViewVentas
  const canUseMapa = currentRole === 'admin'
  const canUseTraspasos = currentRole === 'admin'
  const canCreateCliente = !!capabilities?.editar_clientes
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
          const { data: lotesDemo, error: lotesDemoErr } = await supabase
            .from('lote')
            .select('loteid, estatus')
            .in('desarrolloid', DEMO_DESARROLLOIDS)
          if (lotesDemoErr) throw lotesDemoErr
          const loteIds = (lotesDemo || []).map((l: any) => l.loteid)
          const lotesDisponibles = (lotesDemo || []).filter((l: any) => l.estatus === 'D').length

          const { data: ventasDemo, error: ventasDemoErr } = await supabase
            .from('venta')
            .select('ventaid, clienteid, estatus, fecha')
            .in('loteid', loteIds.length ? loteIds : [-1])
          if (ventasDemoErr) throw ventasDemoErr
          const ventaIds = (ventasDemo || []).map((v: any) => v.ventaid)
          const clienteIds = [...new Set((ventasDemo || []).map((v: any) => v.clienteid).filter(Boolean))]
          const ventasActivas = (ventasDemo || []).filter((v: any) => v.estatus === 'A').length

          const { data: corridasDemo, error: corridasDemoErr } = await supabase
            .from('corridafinanciera')
            .select('corridafinancieraid')
            .in('ventaid', ventaIds.length ? ventaIds : [-1])
          if (corridasDemoErr) throw corridasDemoErr
          const corridaIds = (corridasDemo || []).map((c: any) => c.corridafinancieraid)

          const { data: pagosDemo, error: pagosDemoErr } = corridaIds.length
            ? await supabase
              .from('pagos')
              .select('montopagado, servicios_extra, fechapago, estatus')
              .in('corridafinancieraid', corridaIds)
            : { data: [], error: null }
          if (pagosDemoErr) throw pagosDemoErr

          const { data: pagosMesRaw, error: pagosMesErr } = await supabase
            .from('pagos')
            .select('montopagado, servicios_extra, fechapago, corridafinancieraid')
            .gte('fechapago', firstOfMonth)
            .lt('fechapago', firstOfNextMonth)
            .limit(10000)
          if (pagosMesErr) throw pagosMesErr

          const corridaIdsMes = [...new Set((pagosMesRaw || []).map((p: any) => p.corridafinancieraid).filter(Boolean))]
          const { data: corridasMesData, error: corridasMesErr } = corridaIdsMes.length > 0
            ? await supabase
              .from('corridafinanciera')
              .select('corridafinancieraid, ventaid')
              .in('corridafinancieraid', corridaIdsMes)
            : { data: [], error: null }
          if (corridasMesErr) throw corridasMesErr

          const corridaVentaMap = new Map<number, number>((corridasMesData || []).map((c: any) => [c.corridafinancieraid, c.ventaid]))
          const ventaIdsMes = [...new Set((corridasMesData || []).map((c: any) => c.ventaid).filter(Boolean))]

          const { data: ventasMesData, error: ventasMesErr } = ventaIdsMes.length > 0
            ? await supabase
              .from('venta')
              .select('ventaid, loteid')
              .in('ventaid', ventaIdsMes)
            : { data: [], error: null }
          if (ventasMesErr) throw ventasMesErr

          const ventaLoteMap = new Map<number, number>((ventasMesData || []).map((v: any) => [v.ventaid, v.loteid]))
          const loteIdsMes = [...new Set((ventasMesData || []).map((v: any) => v.loteid).filter(Boolean))]

          const { data: lotesMesData, error: lotesMesErr } = loteIdsMes.length > 0
            ? await supabase
              .from('lote')
              .select('loteid, desarrolloid')
              .in('loteid', loteIdsMes)
            : { data: [], error: null }
          if (lotesMesErr) throw lotesMesErr

          const loteDesarrolloMap = new Map<number, number>((lotesMesData || []).map((l: any) => [l.loteid, l.desarrolloid]))

          const pagosDelMesData = (pagosMesRaw || []).filter((p: any) => {
            const ventaid = corridaVentaMap.get(p.corridafinancieraid)
            if (!ventaid) return false
            const loteid = ventaLoteMap.get(ventaid)
            if (!loteid) return false
            const desarrolloid = loteDesarrolloMap.get(loteid)
            if (!desarrolloid) return false
            return DEMO_DESARROLLOIDS.includes(desarrolloid)
          })
          const ventasEsteMes = (ventasDemo || []).filter((v: any) => {
            return v.estatus !== 'C' && isWithinMonth(v.fecha, firstOfMonth, firstOfNextMonth)
          }).length

          const totalPagado = (pagosDemo || []).reduce((sum: number, p: any) => {
            const extra = Number(p.servicios_extra || 0)
            return sum + Number(p.montopagado || 0) + Math.max(0, extra)
          }, 0)
          const pagosDelMes = (pagosDelMesData || []).reduce((sum: number, p: any) => {
            const extra = Number(p.servicios_extra || 0)
            return sum + Number(p.montopagado || 0) + Math.max(0, extra)
          }, 0)

          setStats({
            totalClientes: clienteIds.length,
            totalDesarrollos: DEMO_DESARROLLOIDS.length,
            totalVentas: ventaIds.length,
            totalPagado,
            pagosDelMes,
            ventasEsteMes,
            lotesDisponibles,
            ventasActivas,
          })
          setCached('dashboard:stats', {
            totalClientes: clienteIds.length,
            totalDesarrollos: DEMO_DESARROLLOIDS.length,
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
          const { data: lotesData } = await supabase
            .from('lote').select('loteid').in('desarrolloid', DEMO_DESARROLLOIDS)
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
          .select('corridafinancieraid, ventaid, mensualidad, venta:venta!inner(estatus, clienteid, cliente:cliente(nombre), lote:lote(manzana, nolote, desarrolloid))')
          .lt('fecha', today)
          .gt('nopago', 0)
          .limit(5000)

        if (demoVentaIds) corridasQuery = corridasQuery.in('ventaid', demoVentaIds)

        const { data: corridasData, error: corridasErr } = await corridasQuery

        if (corridasErr || !corridasData?.length) { setTotalCarteraVencida(0); setLoadingRiesgo(false); return }

        // Only active ventas
        const corridasFiltradas = (corridasData as any[]).filter((c) => {
          const venta = Array.isArray(c.venta) ? c.venta[0] : c.venta
          return venta?.estatus === 'A'
        })

        if (!corridasFiltradas.length) { setVentasEnRiesgo([]); setTotalCarteraVencida(0); setLoadingRiesgo(false); return }

        const corridaIds = corridasFiltradas.map((c: any) => c.corridafinancieraid)

        // Query 2: todos los pagos activos de esas corridas (una sola query)
        const { data: pagosData } = await supabase
          .from('pagos')
          .select('corridafinancieraid, montopagado')
          .in('corridafinancieraid', corridaIds)
          .neq('estatus', 'C')

        // Build pagos map: corridaId → totalPagado
        const pagosMap = new Map<number, number>()
        for (const p of pagosData || []) {
          const prev = pagosMap.get(p.corridafinancieraid) ?? 0
          pagosMap.set(p.corridafinancieraid, prev + (p.montopagado || 0))
        }

        // Group corridas by ventaid, count vencidas
        // Also sum total cartera vencida (all unpaid, not just 3+)
        let totalCartera = 0
        const ventaMap = new Map<number, { venta: any; vencidas: number }>()
        for (const c of corridasFiltradas) {
          const pagado = pagosMap.get(c.corridafinancieraid) ?? 0
          const pendiente = Math.max(0, (c.mensualidad || 0) - pagado)
          if (pendiente <= 0) continue  // ya pagada
          totalCartera += pendiente

          const venta = Array.isArray(c.venta) ? c.venta[0] : c.venta
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

        // Query 3: último aviso por cada venta en riesgo (una sola query)
        const ventaIds = ventasConRiesgo.map((v) => v.ventaid)
        const { data: avisosData } = await supabase
          .from('avisos_cancelacion')
          .select('ventaid, tipo, fecha_envio')
          .in('ventaid', ventaIds)
          .order('fecha_envio', { ascending: false })

        // Build aviso map: ventaid → último aviso
        const avisosMap = new Map<number, { tipo: string; fecha_envio: string }>()
        for (const a of avisosData || []) {
          if (!avisosMap.has(a.ventaid)) avisosMap.set(a.ventaid, a)
        }

        // Build result
        const diffDays = (from: string) =>
          Math.floor((new Date().getTime() - new Date(from).getTime()) / 86_400_000)

        const resultados: VentaEnRiesgo[] = ventasConRiesgo.map(({ ventaid, venta, vencidas }) => {
          const ultimoAviso = avisosMap.get(ventaid) ?? null
          let etapa = 'Sin avisos'
          if (ultimoAviso) {
            const dias = diffDays(ultimoAviso.fecha_envio)
            if (ultimoAviso.tipo === 'AVISO1') etapa = dias < 5 ? `Aviso 1 (hace ${dias}d)` : `Aviso 1 vencido (${dias}d)`
            else if (ultimoAviso.tipo === 'AVISO2') etapa = dias < 5 ? `Aviso 2 (hace ${dias}d)` : `Doc. cancelación pendiente`
            else etapa = 'Cancelación registrada'
          }
          return {
            ventaid,
            clienteNombre: venta?.cliente?.nombre ?? 'Sin nombre',
            loteLabel: `Mza ${venta?.lote?.manzana ?? '-'} / ${venta?.lote?.nolote ?? '-'}`,
            corridasVencidas: vencidas,
            ultimoAviso: ultimoAviso?.fecha_envio ?? null,
            etapa,
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
                  loteLabel: lote ? `Mza ${lote.manzana} – L${lote.nolote}${lote.clavelote ? ` (${lote.clavelote})` : ''}` : '—',
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
              supabase.from('lote').select('loteid, manzana, nolote, desarrolloid').in('loteid', ventaLoteIds),
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
                loteLabel: lote ? `Mza ${lote.manzana} – L${lote.nolote}` : '—',
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

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    onClick,
  }: {
    title: string
    value: string | number
    icon: React.ReactNode
    color: string
    onClick?: () => void
  }) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md border-l-4 p-6 transition-shadow ${onClick ? 'cursor-pointer hover:shadow-lg' : 'hover:shadow-lg'}`}
      style={{ borderColor: color }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#9e9f92] text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-black mt-2">{value}</p>
        </div>
        <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
          {Icon}
        </div>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Dashboard</h1>
            <p className="text-[#9e9f92] mt-1 capitalize">{monthName}</p>
            {currentRole && (
              <p className="text-xs text-gray-500 mt-1">Vista de rol: {ROLE_LABELS[currentRole]}</p>
            )}
          </div>
        </div>

        {!loading && (loadingRiesgo || loadingRecent) && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
            <span className="h-3 w-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            Actualizando indicadores del panel...
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="inline-block h-8 w-8 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── KPIs por rol ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {canViewClientes && (
                <StatCard
                  title="Clientes"
                  value={stats.totalClientes}
                  icon={<Users className="w-8 h-8 text-white" />}
                  color="#9e9f92"
                  onClick={() => navigate('/admin/clientes')}
                />
              )}
              {canViewVentas && (
                <StatCard
                  title="Ventas activas"
                  value={stats.ventasActivas}
                  icon={<ShoppingCart className="w-8 h-8 text-black" />}
                  color="#eaae4c"
                  onClick={() => navigate('/admin/ventas')}
                />
              )}
              {canViewPagos && (
                <StatCard
                  title="Cartera vencida"
                  value={loadingRiesgo ? '…' : formatCurrency(totalCarteraVencida)}
                  icon={<DollarSign className="w-8 h-8 text-white" />}
                  color={totalCarteraVencida > 0 ? '#dc2626' : '#16a34a'}
                  onClick={() => navigate('/admin/pagos')}
                />
              )}
              {canViewPagos && (
                <StatCard
                  title="Cobrado"
                  value={loading ? '…' : formatCurrency(stats.pagosDelMes)}
                  icon={<TrendingUp className="w-8 h-8 text-white" />}
                  color="#504840"
                  onClick={() => navigate('/admin/pagos')}
                />
              )}
              {canViewLotes && (
                <StatCard
                  title="Lotes disponibles"
                  value={stats.lotesDisponibles}
                  icon={<Home className="w-8 h-8 text-white" />}
                  color="#9e9f92"
                  onClick={() => navigate('/admin/lotes')}
                />
              )}
              {canViewDesarrollos && (
                <StatCard
                  title="Desarrollos"
                  value={stats.totalDesarrollos}
                  icon={<MapPin className="w-8 h-8 text-white" />}
                  color="#504840"
                  onClick={() => navigate('/admin/desarrollos')}
                />
              )}
              {canViewRiesgo && (
                <div
                  onClick={() => document.getElementById('riesgo-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white rounded-lg shadow-md border-l-4 border-red-500 p-6 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#9e9f92] text-sm font-medium">En riesgo de cancelación</p>
                      <p className="text-3xl font-bold text-black mt-2">
                        {loadingRiesgo ? '…' : ventasEnRiesgo.length}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-red-500">
                      <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              )}
              {canViewVentas && (
                <StatCard
                  title="Ventas"
                  value={loading ? '…' : stats.ventasEsteMes}
                  icon={<ShoppingCart className="w-8 h-8 text-white" />}
                  color="#16a34a"
                  onClick={() => navigate('/admin/ventas')}
                />
              )}
            </div>
          </>
        )}

        {/* ── Accesos rápidos ── */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-3">
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-[#eaae4c] hover:text-[#504840] hover:shadow-sm transition-all"
              >
                {(item as { icon: React.ReactNode }).icon}
                {(item as { label: string }).label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Actividad reciente ── */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Últimos pagos */}
          {canViewPagos && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#eaae4c]" />
                <h3 className="font-semibold text-gray-800">Últimos pagos registrados</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/pagos')}
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todos
              </button>
            </div>
            {loadingRecent ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin" />
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
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#eaae4c]" />
                <h3 className="font-semibold text-gray-800">Últimas ventas registradas</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/ventas')}
                className="text-xs text-blue-600 hover:underline"
              >
                Ver todas
              </button>
            </div>
            {loadingRecent ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin" />
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

        {/* ── Ventas en riesgo de cancelación ── */}
        {canViewRiesgo && (
        <div id="riesgo-section" className="mt-8">
          {loadingRiesgo ? (
            <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-3 text-gray-400">
              <div className="h-5 w-5 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Verificando atrasos...</span>
            </div>
          ) : ventasEnRiesgo.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-3 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Sin ventas en riesgo</p>
                <p className="text-xs text-green-600 mt-0.5">No hay ventas con 3 o más mensualidades vencidas</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-red-600">
              {/* Header */}
              <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-white" />
                  <h2 className="text-lg font-bold text-white">Ventas en riesgo de cancelación</h2>
                </div>
                <span className="bg-white text-red-600 text-sm font-bold px-3 py-1 rounded-full">
                  {ventasEnRiesgo.length} {ventasEnRiesgo.length === 1 ? 'venta' : 'ventas'}
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b-2 border-red-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Cliente</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Lote</th>
                      <th className="px-5 py-3 text-center text-xs font-bold text-red-800 uppercase tracking-wider">Pagos vencidos</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Etapa</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Último aviso</th>
                      <th className="px-5 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {ventasEnRiesgo.map((v) => (
                      <tr key={v.ventaid} className="hover:bg-red-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-900">{v.clienteNombre}</p>
                          <p className="text-xs text-gray-400">Venta #{v.ventaid}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{v.loteLabel}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-block bg-red-600 text-white text-sm font-bold w-8 h-8 rounded-full leading-8 text-center">
                            {v.corridasVencidas}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${
                            v.etapa === 'Sin avisos'
                              ? 'bg-red-100 text-red-700'
                              : v.etapa.includes('vencido') || v.etapa.includes('cancelación')
                              ? 'bg-gray-800 text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {v.etapa}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {v.ultimoAviso ? formatDate(v.ultimoAviso) : <span className="text-red-400 font-medium">Sin avisos</span>}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/ventas/${v.ventaid}`)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            <Eye size={13} />
                            Ver
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
        )}

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
