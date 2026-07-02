import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, MapPin, ShoppingCart, DollarSign, AlertTriangle, Eye, CheckCircle2,
  Home, Plus, CreditCard, UserPlus, ArrowLeftRight, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { formatCurrency, formatDate } from '@/utils/helpers'
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

export const Dashboard = () => {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    totalDesarrollos: 0,
    totalVentas: 0,
    totalPagado: 0,
    pagosDelMes: 0,
    lotesDisponibles: 0,
    ventasActivas: 0,
  })
  const [loading, setLoading] = useState(true)
  const [ventasEnRiesgo, setVentasEnRiesgo] = useState<VentaEnRiesgo[]>([])
  const [loadingRiesgo, setLoadingRiesgo] = useState(true)
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
      try {
        const now = new Date()
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

        if (DEMO_DESARROLLOIDS.length > 0) {
          const { data: lotesDemo } = await supabase
            .from('lote')
            .select('loteid, estatus')
            .in('desarrolloid', DEMO_DESARROLLOIDS)
          const loteIds = (lotesDemo || []).map((l: any) => l.loteid)
          const lotesDisponibles = (lotesDemo || []).filter((l: any) => l.estatus === 'D').length

          const { data: ventasDemo } = await supabase
            .from('venta')
            .select('ventaid, clienteid, estatus')
            .in('loteid', loteIds.length ? loteIds : [-1])
          const ventaIds = (ventasDemo || []).map((v: any) => v.ventaid)
          const clienteIds = [...new Set((ventasDemo || []).map((v: any) => v.clienteid).filter(Boolean))]
          const ventasActivas = (ventasDemo || []).filter((v: any) => v.estatus === 'A').length

          const { data: corridasDemo } = await supabase
            .from('corridafinanciera')
            .select('corridafinancieraid')
            .in('ventaid', ventaIds.length ? ventaIds : [-1])
          const corridaIds = (corridasDemo || []).map((c: any) => c.corridafinancieraid)

          const { data: pagosDemo } = corridaIds.length
            ? await supabase.from('pagos').select('montopagado, fechapago').in('corridafinancieraid', corridaIds)
            : { data: [] }

          const totalPagado = (pagosDemo || []).reduce((sum: number, p: any) => sum + (p.montopagado || 0), 0)
          const pagosDelMes = (pagosDemo || [])
            .filter((p: any) => p.fechapago >= firstOfMonth)
            .reduce((sum: number, p: any) => sum + (p.montopagado || 0), 0)

          setStats({
            totalClientes: clienteIds.length,
            totalDesarrollos: DEMO_DESARROLLOIDS.length,
            totalVentas: ventaIds.length,
            totalPagado,
            pagosDelMes,
            lotesDisponibles,
            ventasActivas,
          })
        } else {
          const [clientesRes, desarrollosRes, ventasRes, pagosRes, lotesDisponiblesRes, ventasActivasRes, pagosDelMesRes] = await Promise.all([
            supabase.from('cliente').select('*', { count: 'exact', head: true }),
            supabase.from('desarrollo').select('*', { count: 'exact', head: true }),
            supabase.from('venta').select('*', { count: 'exact', head: true }),
            supabase.from('pagos').select('montopagado'),
            supabase.from('lote').select('*', { count: 'exact', head: true }).eq('estatus', 'D'),
            supabase.from('venta').select('*', { count: 'exact', head: true }).eq('estatus', 'A'),
            supabase.from('pagos').select('montopagado').gte('fechapago', firstOfMonth),
          ])

          const totalPagado = pagosRes.data?.reduce((sum, p) => sum + (p.montopagado || 0), 0) || 0
          const pagosDelMes = pagosDelMesRes.data?.reduce((sum, p) => sum + (p.montopagado || 0), 0) || 0

          setStats({
            totalClientes: clientesRes.count || 0,
            totalDesarrollos: desarrollosRes.count || 0,
            totalVentas: ventasRes.count || 0,
            totalPagado,
            pagosDelMes,
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
  }, [])

  // ── Ventas en riesgo de cancelación ────────────────────────────
  useEffect(() => {
    if (!canViewRiesgo) {
      setVentasEnRiesgo([])
      setLoadingRiesgo(false)
      return
    }

    const fetchRiesgo = async () => {
      try {
        setLoadingRiesgo(true)
        const today = new Date().toISOString().split('T')[0]

        // Query 1: todas las corridas vencidas de ventas activas (una sola query con join)
        const { data: corridasData, error: corridasErr } = await supabase
          .from('corridafinanciera')
          .select('corridafinancieraid, ventaid, mensualidad, venta:venta!inner(estatus, clienteid, cliente:cliente(nombre), lote:lote(manzana, nolote, desarrolloid))') 
          .lt('fecha', today)
          .gt('nopago', 0)
          .eq('venta.estatus', 'A')

        if (corridasErr || !corridasData?.length) { setLoadingRiesgo(false); return }

        // Filter by demo desarrolloid after fetch
        const corridasFiltradas = DEMO_DESARROLLOIDS.length > 0
          ? (corridasData as any[]).filter((c) => {
              const lote = Array.isArray(c.venta?.lote) ? c.venta.lote[0] : c.venta?.lote
              return DEMO_DESARROLLOIDS.includes(lote?.desarrolloid)
            })
          : (corridasData as any[])

        if (!corridasFiltradas.length) { setVentasEnRiesgo([]); setLoadingRiesgo(false); return }

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
        const ventaMap = new Map<number, { venta: any; vencidas: number }>()
        for (const c of corridasFiltradas) {
          const pagado = pagosMap.get(c.corridafinancieraid) ?? 0
          if (pagado >= (c.mensualidad || 0)) continue  // ya pagada

          const entry = ventaMap.get(c.ventaid)
          if (entry) {
            entry.vencidas++
          } else {
            ventaMap.set(c.ventaid, { venta: c.venta, vencidas: 1 })
          }
        }

        // Filter ventas con >= 3 vencidas
        const ventasConRiesgo = Array.from(ventaMap.entries())
          .filter(([, v]) => v.vencidas >= 3)
          .map(([ventaid, v]) => ({ ventaid, ...v }))

        if (!ventasConRiesgo.length) { setVentasEnRiesgo([]); setLoadingRiesgo(false); return }

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
        setVentasEnRiesgo(resultados)
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

            setVentasRecientes(
              ventasFiltradas.slice(0, 6).map((v: any) => {
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
            )
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
                  title="Total cobrado"
                  value={formatCurrency(stats.totalPagado)}
                  icon={<DollarSign className="w-8 h-8 text-white" />}
                  color="#000000"
                />
              )}
              {canViewPagos && (
                <StatCard
                  title={`Cobrado en ${new Date().toLocaleString('es-MX', { month: 'long' })}`}
                  value={formatCurrency(stats.pagosDelMes)}
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
                  className={`bg-white rounded-lg shadow-md border-l-4 p-6 cursor-pointer hover:shadow-lg transition-shadow ${loadingRiesgo ? 'border-gray-300' : ventasEnRiesgo.length > 0 ? 'border-red-500' : 'border-green-500'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#9e9f92] text-sm font-medium">En riesgo de cancelación</p>
                      <p className="text-3xl font-bold text-black mt-2">
                        {loadingRiesgo ? '…' : ventasEnRiesgo.length}
                      </p>
                    </div>
                    <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${loadingRiesgo ? 'bg-gray-300' : ventasEnRiesgo.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
                      <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
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
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        v.estatus === 'A' ? 'bg-green-100 text-green-700' :
                        v.estatus === 'C' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {v.estatus === 'A' ? 'Activa' : v.estatus === 'C' ? 'Cancelada' : v.estatus}
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
        <div id="riesgo-section" className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3 bg-red-50">
            <AlertTriangle size={22} className="text-red-600" />
            <h2 className="text-xl font-bold text-red-800">Ventas en riesgo de cancelación</h2>
            {!loadingRiesgo && ventasEnRiesgo.length > 0 && (
              <span className="ml-auto bg-red-100 text-red-700 text-sm font-bold px-3 py-0.5 rounded-full">
                {ventasEnRiesgo.length}
              </span>
            )}
          </div>

          {loadingRiesgo ? (
            <div className="px-8 py-10 text-center text-gray-500">
              <div className="inline-block h-6 w-6 border-4 border-[#eaae4c] border-t-transparent rounded-full animate-spin mb-3" />
              <p>Verificando atrasos...</p>
            </div>
          ) : ventasEnRiesgo.length === 0 ? (
            <div className="px-8 py-10 text-center text-green-700 font-medium flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              No hay ventas con 3 o más mensualidades vencidas
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Venta</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lote</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Pagos vencidos</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Etapa</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Último aviso</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ventasEnRiesgo.map((v) => (
                    <tr key={v.ventaid} className="hover:bg-red-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">#{v.ventaid}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{v.clienteNombre}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{v.loteLabel}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-full">
                          {v.corridasVencidas}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.etapa === 'Sin avisos'
                            ? 'bg-red-100 text-red-700'
                            : v.etapa.includes('vencido') || v.etapa.includes('cancelación')
                            ? 'bg-gray-800 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {v.etapa}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {v.ultimoAviso ? formatDate(v.ultimoAviso) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/ventas/${v.ventaid}`)}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          <Eye size={14} />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
