import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';

/**
 * Guard de rutas privadas del portal cliente.
 *
 * Permite el acceso únicamente si el usuario está autenticado con rol 'client'.
 * Redirige a /login en cualquier otro caso.
 *
 * IMPORTANTE: este guard protege la navegación en frontend, pero
 * la seguridad real debe estar en las políticas RLS de Supabase.
 * Nunca asumir que ocultar rutas es suficiente protección.
 */
export function ClientRoute() {
  const { session, isLoading } = useAuth();

  // Esperar a que termine la verificación de sesión antes de decidir
  if (isLoading) {
    return null;
  }

  const canAccess =
    session.isAuthenticated && session.user?.role === 'client';

  if (!canAccess) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
