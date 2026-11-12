import { Outlet, ScrollRestoration } from 'react-router';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { DataProvider } from '../context/DataContext';
import { AvisoPrivacidadGate } from '../components/shared/AvisoPrivacidadGate';

export function ClientLayout() {
  return (
    // The header reads the client's payments too (overdue alert), so the data
    // provider wraps the whole layout, not just the page.
    <DataProvider>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <ScrollRestoration />
        <div className="flex flex-1 flex-col md:flex-row">
          <Sidebar />

          <div className="flex-1 flex flex-col">
            <Header
              title="Mi Portal"
              subtitle="Gestiona tus propiedades y pagos"
            />

            <main className="flex-1 pb-24 md:pb-0">
              <Outlet />
            </main>
          </div>
        </div>

        <Footer />
        <AvisoPrivacidadGate />
      </div>
    </DataProvider>
  );
}
