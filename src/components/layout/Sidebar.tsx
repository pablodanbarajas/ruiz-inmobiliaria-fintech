import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  BarChart3,
  MapPin,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Menu,
  X,
  LogOut,
  User,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const MENU_ITEMS = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: BarChart3,
  },
  {
    label: 'Desarrollos',
    path: '/admin/desarrollos',
    icon: MapPin,
  },
  {
    label: 'Lotes',
    path: '/admin/lotes',
    icon: TrendingUp,
  },
  {
    label: 'Clientes',
    path: '/admin/clientes',
    icon: Users,
  },
  {
    label: 'Ventas',
    path: '/admin/ventas',
    icon: ShoppingCart,
  },
  {
    label: 'Pagos',
    path: '/admin/pagos',
    icon: DollarSign,
  },
]

export const Sidebar = () => {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(true)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-[#eaae4c] text-black rounded cursor-pointer"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-black text-white w-64 transition-transform duration-300 z-30',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 flex flex-col items-center">
          <div className="mb-12 mt-4 lg:mt-0">
            <img 
              src="/images/ruiz-inmobiliaria-logo-sin-fondo.png" 
              alt="Ruiz Inmobiliaria" 
              className="h-40 w-40 object-contain"
            />
          </div>

          {/* User info section */}
          <div className="w-full border-t border-b border-[#504840] py-6 mb-8">
            <div className="flex items-center gap-3 text-white">
              <User size={24} />
              <div className="flex-1">
                <p className="font-medium text-base text-white">
                  {user?.nombre} {user?.apellido}
                </p>
                <p className="text-white text-sm truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-4 flex-1">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-4 px-4 py-4 rounded-lg transition-colors',
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
          <div className="w-full border-t border-[#504840] pt-4">
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
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
