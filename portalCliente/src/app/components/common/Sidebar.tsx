import { Home, MapPin, CreditCard, MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

const publicItems = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Soporte', to: '/soporte', icon: MessageCircle }
];

const privateItems = [
  { label: 'Hogar', to: '/home', icon: Home },
  { label: 'Mis lotes', to: '/mis-lotes', icon: MapPin },
  { label: 'Mis pagos', to: '/mis-pagos', icon: CreditCard },
  { label: 'Soporte', to: '/portal-soporte', icon: MessageCircle }
];

export function Sidebar() {
  const location = useLocation();
  const { session } = useAuth();

  const items = session.isAuthenticated ? privateItems : publicItems;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-teal-700">Ruiz Inmobiliaria</h1>
        <p className="text-sm text-gray-500">Portal web</p>
      </div>

      <nav className="p-4 space-y-2 flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-teal-700 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}