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
} from 'lucide-react'
import { cn } from '@/utils/cn'

const MENU_ITEMS = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: BarChart3,
    roles: ['admin', 'vendedor'],
  },
  {
    label: 'Desarrollos',
    path: '/admin/desarrollos',
    icon: MapPin,
    roles: ['admin'],
  },
  {
    label: 'Lotes',
    path: '/admin/lotes',
    icon: TrendingUp,
    roles: ['admin'],
  },
  {
    label: 'Clientes',
    path: '/admin/clientes',
    icon: Users,
    roles: ['admin', 'vendedor'],
  },
  {
    label: 'Ventas',
    path: '/admin/ventas',
    icon: ShoppingCart,
    roles: ['admin', 'vendedor'],
  },
  {
    label: 'Pagos',
    path: '/admin/pagos',
    icon: DollarSign,
    roles: ['admin', 'vendedor'],
  },
  {
    label: 'Convenios',
    path: '/admin/convenios',
    icon: FileText,
    roles: ['admin'],
  },
  {
    label: 'Cargos Extra',
    path: '/admin/cargos-extra',
    icon: Wrench,
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
        <div className="flex flex-col h-full px-6 pt-6 pb-4 overflow-hidden">
          <div className="mb-8 mt-4 lg:mt-0 flex justify-center flex-shrink-0">
            <img 
              src="/images/ruiz-inmobiliaria-logo-sin-fondo.png" 
              alt="Ruiz Inmobiliaria" 
              className="h-40 w-40 object-contain"
            />
          </div>

          {/* User info section */}
          <div className="w-full border-t border-b border-[#504840] py-4 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3 text-white">
              <User size={24} />
              <div className="flex-1">
                <p className="font-medium text-base text-white">
                  {user?.nombre} {user?.apellido}
                </p>
                <p className="text-white text-sm truncate">{user?.email}</p>
                {role && (
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    role === 'admin'
                      ? 'bg-[#eaae4c] text-black'
                      : 'bg-[#504840] text-white'
                  }`}>
                    {role === 'admin' ? 'Administrador' : 'Vendedor'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-2 w-full">
            {MENU_ITEMS.filter((item) => !role || item.roles.includes(role)).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-[#eaae4c] text-black font-semibold'
                      : 'text-[#f8f8f8] hover:bg-[#504840]'
                  )}
                >
                  <Icon size={28} />
                  <span className="font-medium text-lg">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout button at the bottom */}
          <div className="w-full border-t border-[#504840] pt-3 mt-2 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 text-[#f8f8f8] hover:bg-[#504840] rounded-lg transition-colors font-medium cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
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
