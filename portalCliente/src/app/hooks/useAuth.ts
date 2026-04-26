import { useAuthContext } from '../context/AuthContext';

/**
 * Hook principal para consumir el estado de autenticación.
 *
 * Uso:
 *   const { session, login, logout, isLoading } = useAuth();
 *   if (session.isAuthenticated) { ... }
 *
 * El componente que use este hook debe estar dentro de <AuthProvider>.
 */
export function useAuth() {
  return useAuthContext();
}
