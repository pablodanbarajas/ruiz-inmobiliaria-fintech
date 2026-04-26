import { Outlet } from 'react-router';
import { Home, MessageCircle } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';

const publicMenuItems = [
  { path: '/',        label: 'Home',    icon: Home },
  { path: '/soporte', label: 'Soporte', icon: MessageCircle }
];

export function PublicLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar menuItems={publicMenuItems} />

      <div className="flex-1 flex flex-col">
        <Header
          title="Portal Web"
          subtitle="Descubre tu próximo patrimonio"
        />

        <main className="flex-1">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}
