import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Mail, Lock, Building2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
 */
export function LoginCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/home';

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
    <div className="flex items-center justify-center min-h-[80vh] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-teal-700 rounded-xl flex items-center justify-center text-white mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Iniciar sesión</h2>
          <p className="text-sm text-gray-600 mt-2">
            Ingresa a tu portal de cliente
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              Recordarme
            </label>

            <a href="#" className="text-sm font-medium text-teal-600 hover:text-teal-500">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar al portal'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">¿Aún no tienes cuenta? </span>
          <Link
            to={`/registro${redirectTo !== '/home' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
            className="font-medium text-teal-600 hover:text-teal-500"
          >
            Regístrate aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
