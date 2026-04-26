import { Outlet } from 'react-router';
import { Home, MapPin, CreditCard, MessageCircle } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';

const clientMenuItems = [
  { path: '/portal',           label: 'Home',      icon: Home },
  { path: '/portal/mis-lotes', label: 'Mis lotes', icon: MapPin },
  { path: '/portal/mis-pagos', label: 'Mis pagos', icon: CreditCard },
  { path: '/portal/soporte',   label: 'Soporte',   icon: MessageCircle }
];

export function ClientLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar menuItems={clientMenuItems} />

      <div className="flex-1 flex flex-col">
        <Header
          title="Mi Portal"
          subtitle="Gestiona tus propiedades y pagos"
        />

        <main className="flex-1">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}
