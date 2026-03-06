import { useEffect, useState } from 'react'
import { Users, MapPin, ShoppingCart, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { formatCurrency } from '@/utils/helpers'

interface Stats {
  totalClientes: number
  totalDesarrollos: number
  totalVentas: number
  totalPagado: number
}

export const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalClientes: 0,
    totalDesarrollos: 0,
    totalVentas: 0,
    totalPagado: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [clientesRes, desarrollosRes, ventasRes, pagosRes] = await Promise.all([
          supabase.from('cliente').select('*', { count: 'exact', head: true }),
          supabase.from('desarrollo').select('*', { count: 'exact', head: true }),
          supabase.from('venta').select('*', { count: 'exact', head: true }),
          supabase.from('pagos').select('montopagado'),
        ])

        const totalPagado = pagosRes.data?.reduce(
          (sum, pago) => sum + (pago.montopagado || 0),
          0
        ) || 0

        setStats({
          totalClientes: clientesRes.count || 0,
          totalDesarrollos: desarrollosRes.count || 0,
          totalVentas: ventasRes.count || 0,
          totalPagado,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
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
          <h1 className="text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Dashboard</h1>
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

        {/* Quick description section */}
        <div className="mt-12 bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-8">
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
