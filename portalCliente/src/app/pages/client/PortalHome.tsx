import { HomeContent } from '../../components/home/HomeContent';
import { ClientStatus } from '../../components/home/ClientStatus';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../context/DataContext';

export function PortalHome() {
  const { session } = useAuth();
  const { developments, developmentsLoading } = useData();

  return (
    <>
      {/* The client's own situation first; the development catalog below. */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4">
        <ClientStatus />
      </div>
      <HomeContent
        isAuthenticated={session.isAuthenticated}
        userName={session.user?.name ?? null}
        initialDevelopments={developments}
        developmentsLoading={developmentsLoading}
      />
    </>
  );
}
