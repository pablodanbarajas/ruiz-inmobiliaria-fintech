import { HomeContent } from '../../components/home/HomeContent';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../context/DataContext';

export function PortalHome() {
  const { session } = useAuth();
  const { developments, developmentsLoading } = useData();

  return (
    <HomeContent
      isAuthenticated={session.isAuthenticated}
      userName={session.user?.name ?? null}
      initialDevelopments={developments}
      developmentsLoading={developmentsLoading}
    />
  );
}
