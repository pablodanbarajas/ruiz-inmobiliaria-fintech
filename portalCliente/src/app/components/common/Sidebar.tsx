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
    <>
      <aside className="hidden md:flex md:w-64 bg-white border-r border-gray-200 min-h-screen flex-col">
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-2 pb-2 pt-1 safe-area-inset-bottom">
        <div className="grid grid-cols-4 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 min-h-[52px] text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}