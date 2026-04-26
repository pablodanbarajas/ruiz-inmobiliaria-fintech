import { Link, useLocation } from 'react-router';
import { Home, MapPin, CreditCard, MessageCircle, Phone, Mail, MapPinned, Facebook, Instagram, Twitter, Building2 } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface SidebarProps {
  menuItems: MenuItem[];
}

export function Sidebar({ menuItems }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-200">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 bg-teal-700 text-white rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-800">Ruiz Inmobiliaria</h1>
            <p className="text-xs text-gray-500">Portal Web</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (location.pathname.startsWith(item.path) && item.path !== '/');
            // Nota: Para '/', manejamos exact match, de lo contrario validamos startsWith
            const exactMatch = item.path === '/' ? location.pathname === '/' : isActive;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${exactMatch 
                      ? 'bg-teal-700 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-800 mb-3">Contáctanos</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>+52 33 1234 5678</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span className="text-xs">contacto@ruizinmobiliaria.com</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPinned className="w-4 h-4 mt-0.5" />
            <span className="text-xs">Av. Principal #123, GDL</span>
          </div>
        </div>
        
        <div className="flex gap-3 mt-4">
          <a href="#" className="text-gray-600 hover:text-teal-700 transition-colors">
            <Facebook className="w-5 h-5" />
          </a>
          <a href="#" className="text-gray-600 hover:text-teal-700 transition-colors">
            <Instagram className="w-5 h-5" />
          </a>
          <a href="#" className="text-gray-600 hover:text-teal-700 transition-colors">
            <Twitter className="w-5 h-5" />
          </a>
        </div>
      </div>
    </aside>
  );
}
