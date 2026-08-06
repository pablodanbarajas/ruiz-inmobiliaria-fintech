import { Menu, User } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/desarrollos': 'Desarrollos',
  '/admin/lotes': 'Lotes',
  '/admin/clientes': 'Clientes',
  '/admin/ventas': 'Ventas',
  '/admin/pagos': 'Tesorería',
  '/admin/ventas-externas': 'Ventas Externas',
  '/admin/convenios': 'Convenios',
  '/admin/contratos': 'Contratos',
  '/admin/cargos-extra': 'Cargos Extra',
  '/admin/traspasos': 'Traspasos',
  '/admin/invitar-clientes': 'Portal — Invitar',
  '/admin/usuarios': 'Usuarios',
  '/admin/cuentas-bancarias': 'Cuentas Bancarias',
  '/admin/reportes-pagos': 'Reportes',
  '/admin/carga-masiva-lotes': 'Carga Masiva',
}

interface HeaderProps {
  onMenuToggle?: () => void
}

export const Header = ({ onMenuToggle }: HeaderProps) => {
  const location = useLocation()
  const { user, role } = useAuth()

  const segments = location.pathname.split('/')
  const basePath = '/' + segments[1] + '/' + segments[2]
  const title = PAGE_TITLES[basePath] ?? PAGE_TITLES[location.pathname] ?? 'Admin'
  const isDetail = segments.length > 3

  return (
    <header className="lg:hidden fixed top-0 right-0 left-0 h-14 bg-black border-b border-[#504840] px-3 flex items-center justify-between z-20 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuToggle}
          className="p-2 bg-[#eaae4c] text-black rounded-lg cursor-pointer flex-shrink-0 active:opacity-80"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">
            {title}{isDetail ? ' — Detalle' : ''}
          </p>
          <p className="text-[#9e9f92] text-[11px] leading-tight truncate">
            Ruiz Inmobiliaria
          </p>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-[#eaae4c] flex items-center justify-center">
            <User size={14} className="text-black" />
          </div>
          <div className="text-right hidden xs:block">
            <p className="text-white text-[11px] font-medium leading-tight truncate max-w-24">
              {user.nombre}
            </p>
            <p className="text-[#eaae4c] text-[10px] leading-tight capitalize">{role}</p>
          </div>
        </div>
      )}
    </header>
  )
}
