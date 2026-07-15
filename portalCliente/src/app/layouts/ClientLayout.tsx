import { Outlet, ScrollRestoration } from 'react-router';
import { Home, MapPin, CreditCard, MessageCircle } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { DataProvider } from '../context/DataContext';

const clientMenuItems = [
  { path: '/home',           label: 'Home',      icon: Home },
  { path: '/home/mis-lotes', label: 'Mis lotes', icon: MapPin },
  { path: '/home/mis-pagos', label: 'Mis pagos', icon: CreditCard },
  { path: '/home/soporte',   label: 'Soporte',   icon: MessageCircle }
];

export function ClientLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <ScrollRestoration />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar menuItems={clientMenuItems} />

        <div className="flex-1 flex flex-col">
          <Header
            title="Mi Portal"
            subtitle="Gestiona tus propiedades y pagos"
          />

          <main className="flex-1 pb-24 md:pb-0">
            <DataProvider>
              <Outlet />
            </DataProvider>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
