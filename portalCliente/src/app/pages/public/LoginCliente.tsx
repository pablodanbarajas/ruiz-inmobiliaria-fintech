import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Marca, LOGO_COMPLETO } from '../../components/common/Marca';
import { PasswordInput } from '../../components/shared/PasswordInput';

/**
 * Pantalla de login del portal cliente.
 *
 * Lee el parámetro `redirect` de la URL para saber a dónde regresar
 * después de iniciar sesión. Esto permite el flujo:
 *
 *   Mapa → clic "Solicitar apartado" sin sesión
 *     → /login?redirect=/desarrollos/dev-1/mapa
 *   Login exitoso → vuelve a /desarrollos/dev-1/mapa
 *
 * Si no hay parámetro redirect, navega al portal por defecto.
 *
 * También maneja el caso donde Supabase redirige aquí tras confirmar
 * email: el cliente JS detecta el token en el hash, establece la
 * sesión y este componente redirige automáticamente al home.
 */
export function LoginCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, session, isLoading } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/home';

  // Si ya hay sesión activa (ej. tras confirmar email), redirigir de inmediato
  useEffect(() => {
    if (!isLoading && session.isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoading, session.isAuthenticated, navigate, redirectTo]);

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)] md:min-h-[80vh] py-6 md:py-12 px-4 sm:px-6 lg:px-8">
      {/* Same layout as the admin sign-in: the brand on black next to the form. */}
      <div className="w-full max-w-4xl grid lg:grid-cols-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden lg:flex bg-marca-negro items-center justify-center p-10">
          <img src={LOGO_COMPLETO} alt="Ruiz Inmobiliaria" className="w-full max-w-xs object-contain" />
        </div>

        <div className="p-6 sm:p-10">
        <div className="text-center mb-6 md:mb-8">
          <div className="flex justify-center mb-5 lg:hidden">
            <Marca fondo="claro" size="md" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-marca-negro">Bienvenido</h2>
          <p className="text-sm text-gray-600 mt-2">
            Consulta tus lotes, pagos y comprobantes
          </p>
        </div>

        <form className="space-y-5 md:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <PasswordInput
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* "Recordarme" was removed: it wasn't wired to anything, and the session already persists. */}
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-3 px-4 rounded-full text-sm font-semibold text-white bg-marca-negro hover:bg-marca-carbon focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-marca-oro disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar al portal'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">¿Aún no tienes cuenta? </span>
          <Link
            to={`/registro${redirectTo !== '/home' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
            className="font-medium text-teal-700 hover:text-teal-800"
          >
            Regístrate aquí
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
