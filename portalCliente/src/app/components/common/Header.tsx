import { Bell, LogOut, LogIn } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useOptionalData } from '../../context/DataContext';

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
  const pending = useOptionalData()?.paymentSummary?.pendingPayments ?? [];
  const atrasados = pending.filter((pago) => pago.status === 'atrasado').length;
  const porVencer = pending.filter((pago) => pago.status === 'por_vencer').length;
  const alertLabel = atrasados > 0
    ? `${atrasados} pago${atrasados === 1 ? '' : 's'} vencido${atrasados === 1 ? '' : 's'}`
    : porVencer > 0
      ? `${porVencer} pago${porVencer === 1 ? '' : 's'} por vencer`
      : 'Sin pagos pendientes por ahora';

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          {/* Brand visible solo en móvil (en desktop lo muestra el Sidebar) */}
          <p className="text-sm font-bold text-teal-700 md:hidden">Ruiz Inmobiliaria</p>
          <h2 className="text-base md:text-2xl font-semibold text-gray-800 leading-tight">{title}</h2>
          <p className="text-xs text-gray-500 hidden md:block">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {user ? (
            <>
              {/* Payment alert: overdue (red count) or due within 7 days (amber dot). */}
              <Link
                to="/mis-pagos"
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex"
                aria-label={alertLabel}
                title={alertLabel}
              >
                <Bell className="w-5 h-5" />
                {atrasados > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {atrasados}
                  </span>
                ) : porVencer > 0 ? (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                ) : null}
              </Link>

              <div className="flex items-center gap-2 md:gap-3 md:pl-4 md:border-l md:border-gray-200">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-800 truncate max-w-44">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate max-w-44">{user.email}</p>
                </div>

                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-700 rounded-full flex items-center justify-center text-white flex-shrink-0">
                    <span className="text-xs font-bold">{user.name?.charAt(0).toUpperCase()}</span>
                  </div>
                )}

                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
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
