import { Bell, LogOut, LogIn, User } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

/**
 * Header global de la aplicación.
 *
 * Lee la sesión directamente desde el contexto de autenticación.
 * El botón de logout llama a authService.logout() a través del contexto,
 * lo que actualiza el estado global y redirige por el guard ClientRoute.
 */
export function Header({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  const { session, logout } = useAuth();
  const user = session.user;

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 sticky top-0 z-10">
      <div className="flex items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">{title}</h2>
          <p className="text-xs md:text-sm text-gray-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {user ? (
            <>
              <button
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-gray-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-800 truncate max-w-44">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate max-w-44">{user.email}</p>
                </div>

                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-100 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 md:w-10 md:h-10 bg-teal-700 rounded-full flex items-center justify-center text-white">
                    <User className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                )}

                <button
                  onClick={logout}
                  className="ml-1 md:ml-2 p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4">
              <Link
                to="/login"
                className="text-teal-700 font-medium hover:text-teal-800 transition-colors flex items-center gap-2 px-3 md:px-4 py-2 border border-teal-700 rounded-lg hover:bg-teal-50 text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Iniciar sesión</span>
              </Link>
              <Link
                to="/registro"
                className="bg-teal-700 text-white font-medium hover:bg-teal-800 transition-colors px-3 md:px-4 py-2 rounded-lg text-sm"
              >
                <span className="hidden sm:inline">Crear cuenta</span>
                <span className="sm:hidden">Registro</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
