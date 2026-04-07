import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, MapPin, ShoppingCart, DollarSign, AlertTriangle, Eye, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

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
}

export const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    totalDesarrollos: 0,
    totalVentas: 0,
    totalPagado: 0,
  })
  const [loading, setLoading] = useState(true)
  const [ventasEnRiesgo, setVentasEnRiesgo] = useState<VentaEnRiesgo[]>([])
  const [loadingRiesgo, setLoadingRiesgo] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (DEMO_DESARROLLOIDS !== null) {
          // Scoped stats: only data related to the demo desarrollos

          // 1. Lotes of these desarrollos
          const { data: lotesDemo } = await supabase
            .from('lote')
            .select('loteid')
            .in('desarrolloid', DEMO_DESARROLLOIDS)
          const loteIds = (lotesDemo || []).map((l: any) => l.loteid)

          // 2. Ventas of those lotes
          const { data: ventasDemo } = await supabase
            .from('venta')
            .select('ventaid, clienteid')
            .in('loteid', loteIds.length ? loteIds : [-1])
          const ventaIds = (ventasDemo || []).map((v: any) => v.ventaid)
          const clienteIds = [...new Set((ventasDemo || []).map((v: any) => v.clienteid).filter(Boolean))]

          // 3. Corridas of those ventas → pagos
          const { data: corridasDemo } = await supabase
            .from('corridafinanciera')
            .select('corridafinancieraid')
            .in('ventaid', ventaIds.length ? ventaIds : [-1])
          const corridaIds = (corridasDemo || []).map((c: any) => c.corridafinancieraid)

          const { data: pagosDemo } = corridaIds.length
            ? await supabase
                .from('pagos')
                .select('montopagado')
                .in('corridafinancieraid', corridaIds)
            : { data: [] }

          const totalPagado = (pagosDemo || []).reduce(
            (sum: number, p: any) => sum + (p.montopagado || 0), 0
          )

          setStats({
            totalClientes: clienteIds.length,
            totalDesarrollos: 1,
            totalVentas: ventaIds.length,
            totalPagado,
          })
        } else {
          const [clientesRes, desarrollosRes, ventasRes, pagosRes] = await Promise.all([
            supabase.from('cliente').select('*', { count: 'exact', head: true }),
            supabase.from('desarrollo').select('*', { count: 'exact', head: true }),
            supabase.from('venta').select('*', { count: 'exact', head: true }),
            supabase.from('pagos').select('montopagado'),
          ])

          const totalPagado = pagosRes.data?.reduce(
            (sum, pago) => sum + (pago.montopagado || 0), 0
          ) || 0

          setStats({
            totalClientes: clientesRes.count || 0,
            totalDesarrollos: desarrollosRes.count || 0,
            totalVentas: ventasRes.count || 0,
            totalPagado,
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
        const corridasFiltradas = DEMO_DESARROLLOIDS !== null
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
  }, [])

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string
    value: string | number
    icon: React.ReactNode
    color: string
  }) => (
    <div className="bg-white rounded-lg shadow-md border-l-4 p-6 hover:shadow-lg transition-shadow" style={{ borderColor: color }}>
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
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Dashboard</h1>
          <p className="text-[#9e9f92] mt-2">Bienvenido al sistema de administración</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin">
                <div className="h-8 w-8 border-4 border-[#eaae4c] border-t-transparent rounded-full"></div>
              </div>
              <p className="mt-4 text-[#9e9f92]">Cargando estadísticas...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total de Clientes"
              value={stats.totalClientes}
              icon={<Users className="w-8 h-8 text-white" />}
              color="#9e9f92"
            />
            <StatCard
              title="Total de Desarrollos"
              value={stats.totalDesarrollos}
              icon={<MapPin className="w-8 h-8 text-white" />}
              color="#504840"
            />
            <StatCard
              title="Total de Ventas"
              value={stats.totalVentas}
              icon={<ShoppingCart className="w-8 h-8 text-black" />}
              color="#eaae4c"
            />
            <StatCard
              title="Total Pagado"
              value={formatCurrency(stats.totalPagado)}
              icon={<DollarSign className="w-8 h-8 text-white" />}
              color="#000000"
            />
          </div>
        )}

        {/* Ventas en riesgo de cancelación */}
        <div className="mt-10 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-200 flex items-center gap-3 bg-red-50">
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

        {/* Quick description section */}
        <div className="mt-10 bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-8">
          <h2 className="text-2xl font-bold text-black mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Sistema de Administración</h2>
          <p className="text-[#9e9f92] mb-4">
            Este panel le permite consultar la información de:
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[#504840]">
            <li className="flex items-start gap-2">
              <span className="text-[#eaae4c] font-bold mt-1">•</span>
              <span><strong>Desarrollos:</strong> Listado de proyectos inmobiliarios</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#eaae4c] font-bold mt-1">•</span>
              <span><strong>Lotes:</strong> Terrenos disponibles y vendidos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#eaae4c] font-bold mt-1">•</span>
              <span><strong>Clientes:</strong> Información de compradores</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#eaae4c] font-bold mt-1">•</span>
              <span><strong>Ventas:</strong> Histórico de transacciones</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#eaae4c] font-bold mt-1">•</span>
              <span><strong>Pagos:</strong> Registro de pagos realizados</span>
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  )
}
