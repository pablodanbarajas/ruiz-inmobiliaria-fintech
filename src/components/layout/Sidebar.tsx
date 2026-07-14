import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  BarChart3,
  MapPin,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  FileText,
  Wrench,
  LogOut,
  User,
  Send,
  ArrowLeftRight,
  ShieldCheck,
  LandPlot,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { ROLE_LABELS } from '@/config/roles'

const MENU_ITEMS = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: BarChart3,
    roles: ['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja'],
  },
  {
    label: 'Desarrollos',
    path: '/admin/desarrollos',
    icon: MapPin,
    roles: ['admin', 'finanzas'],
  },
  {
    label: 'Lotes',
    path: '/admin/lotes',
    icon: TrendingUp,
    roles: ['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja'],
  },
  {
    label: 'Clientes',
    path: '/admin/clientes',
    icon: Users,
    roles: ['admin', 'contratos'],
  },
  {
    label: 'Ventas',
    path: '/admin/ventas',
    icon: ShoppingCart,
    roles: ['admin', 'contratos', 'cobranza_caja'],
  },
  {
    label: 'Tesorería',
    path: '/admin/pagos',
    icon: DollarSign,
    roles: ['admin', 'finanzas', 'contratos', 'cobranza_caja'],
  },
  {
    label: 'Convenios',
    path: '/admin/convenios',
    icon: FileText,
    roles: ['admin'],
  },
  {
    label: 'Contratos',
    path: '/admin/contratos',
    icon: FileText,
    roles: ['admin', 'contratos'],
  },
  {
    label: 'Cargos Extra',
    path: '/admin/cargos-extra',
    icon: Wrench,
    roles: ['admin'],
  },
  {
    label: 'Traspasos',
    path: '/admin/traspasos',
    icon: ArrowLeftRight,
    roles: ['admin'],
  },
  {
    label: 'Portal — Invitar',
    path: '/admin/invitar-clientes',
    icon: Send,
    roles: ['admin'],
  },
  {
    label: 'Usuarios',
    path: '/admin/usuarios',
    icon: ShieldCheck,
    roles: ['admin'],
  },
  {
    label: 'Cuentas Bancarias',
    path: '/admin/cuentas-bancarias',
    icon: LandPlot,
    roles: ['admin'],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-black text-white w-64 transition-transform duration-300 z-30 flex flex-col',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full px-4 pt-3 pb-2 overflow-hidden">
          <div className="mb-3 mt-1 lg:mt-0 flex justify-center flex-shrink-0">
            <img 
              src="/images/ruiz-inmobiliaria-logo-sin-fondo.png" 
              alt="Ruiz Inmobiliaria" 
              className="h-16 w-16 object-contain"
            />
          </div>

          {/* User info section */}
          <div className="w-full border-t border-b border-[#504840] py-2 mb-2 flex-shrink-0">
            <div className="flex items-center gap-2 text-white">
              <User size={18} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-white truncate">
                  {user?.nombre} {user?.apellido}
                </p>
                <p className="text-white text-xs truncate opacity-70">{user?.email}</p>
                {role && (
                  <span className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    role === 'admin'
                      ? 'bg-[#eaae4c] text-black'
                      : 'bg-[#504840] text-white'
                  }`}>
                    {ROLE_LABELS[role] ?? role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-0.5 w-full">
            {MENU_ITEMS.filter((item) => !role || item.roles.includes(role)).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-[#eaae4c] text-black font-semibold'
                      : 'text-[#f8f8f8] hover:bg-[#504840]'
                  )}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout button at the bottom */}
          <div className="w-full border-t border-[#504840] pt-2 mt-1 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[#f8f8f8] hover:bg-[#504840] rounded-lg transition-colors font-medium cursor-pointer text-sm"
              title="Cerrar sesión"
            >
              <LogOut size={17} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  )
}
