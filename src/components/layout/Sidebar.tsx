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
  Landmark,
  Handshake,
  UserCheck,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { ROLE_LABELS } from '@/config/roles'

const MENU_ITEMS = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: BarChart3,
    roles: ['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'],
  },
  {
    label: 'Desarrollos',
    path: '/admin/desarrollos',
    icon: MapPin,
    roles: ['admin', 'finanzas', 'desarrollo_ri'],
  },
  {
    label: 'Lotes',
    path: '/admin/lotes',
    icon: TrendingUp,
    roles: ['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'],
  },
  {
    label: 'Clientes',
    path: '/admin/clientes',
    icon: Users,
    roles: ['admin', 'contratos', 'desarrollo_ri'],
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
    label: 'Ventas Externas',
    path: '/admin/ventas-externas',
    icon: UserCheck,
    roles: ['admin', 'finanzas', 'vendedor_externo'],
  },
  {
    label: 'Convenios',
    path: '/admin/convenios',
    icon: Handshake,
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
    icon: Landmark,
    roles: ['admin'],
  },
]

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export const Sidebar = ({ isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) => {
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
          'fixed left-0 top-0 h-screen bg-[#142127] text-white transition-[width,transform] duration-300 z-30 flex flex-col',
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className={`flex flex-col h-full pt-3 pb-2 overflow-hidden ${isCollapsed ? 'px-3' : 'px-4'}`}>
          <div className={`group relative mb-4 mt-1 lg:mt-0 flex items-center flex-shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between gap-3 px-2'}`}>
            <img 
              src="/images/ruiz-inmobiliaria-logo-sin-fondo.png" 
              alt="Ruiz Inmobiliaria" 
              className={`object-contain transition-opacity duration-150 ${isCollapsed ? 'h-10 w-10 group-hover:opacity-0' : 'h-12 w-12'}`}
            />
            {isCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="absolute inset-0 m-auto hidden h-8 w-8 items-center justify-center rounded-full bg-[#343c40] text-[#e0e5e7] opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:flex cursor-pointer hover:bg-[#fffa77] hover:text-[#142127]"
                aria-label="Expandir navegación"
                title="Expandir navegación"
              >
                <ChevronsRight size={16} />
                <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-[#131416] px-3 py-2 text-xs font-medium text-white shadow-lg group-hover:block">
                  Expandir navegación
                </span>
              </button>
            )}
            {!isCollapsed && <div>
              <p className="text-sm font-semibold tracking-tight">Ruiz Inmobiliaria</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#c7d5d9]">Panel administrativo</p>
            </div>}
            {!isCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#c7d5d9] hover:bg-[#343c40] hover:text-white transition-colors cursor-pointer"
                aria-label="Contraer navegación"
                title="Contraer navegación"
              >
                <ChevronsLeft size={17} />
              </button>
            )}
          </div>

          {/* User info section */}
          <div className={`w-full border-t border-b border-[#343c40] py-3 mb-3 flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <div className={`flex items-center text-white ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
              <User size={18} />
              {!isCollapsed && <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-white truncate">
                  {user?.nombre} {user?.apellido}
                </p>
                <p className="text-white text-xs truncate opacity-70">{user?.email}</p>
                {role && (
                  <span className={`inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    role === 'admin'
                    ? 'bg-[#fffa77] text-[#142127]'
                    : 'bg-[#343c40] text-white'
                  }`}>
                    {ROLE_LABELS[role] ?? role}
                  </span>
                )}
              </div>}
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
                    'group relative flex items-center rounded-xl transition-colors',
                    isCollapsed ? 'justify-center px-3 py-2.5' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-[#fffa77] text-[#142127] font-semibold'
                      : 'text-[#e0e5e7] hover:bg-[#343c40]'
                  )}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                  {isCollapsed && (
                    <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-[#131416] px-3 py-2 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Logout button at the bottom */}
          <div className="w-full border-t border-[#343c40] pt-2 mt-1 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="group relative w-full flex items-center justify-center gap-2 px-3 py-2 text-[#e0e5e7] hover:bg-[#343c40] rounded-xl transition-colors font-medium cursor-pointer text-sm"
              title="Cerrar sesión"
            >
              <LogOut size={17} />
              {!isCollapsed && <span>Cerrar Sesión</span>}
              {isCollapsed && (
                <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-lg bg-[#131416] px-3 py-2 text-xs font-medium text-white shadow-lg group-hover:block">
                  Cerrar sesión
                </span>
              )}
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
