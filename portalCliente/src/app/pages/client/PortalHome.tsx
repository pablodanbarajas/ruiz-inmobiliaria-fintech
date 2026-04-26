import { HomeContent } from '../../components/home/HomeContent';
import { useAuth } from '../../hooks/useAuth';

export function PortalHome() {
  const { session } = useAuth();

  return (
    <HomeContent
      isAuthenticated={session.isAuthenticated}
      userName={session.user?.name ?? null}
    />
  );
}
