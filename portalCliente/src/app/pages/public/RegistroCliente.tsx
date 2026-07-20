import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { User, Mail, Lock, Phone, Building2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

/**
 * Registro de nuevo cliente.
 *
 * Lee el parámetro `redirect` de la URL para saber a dónde regresar
 * después de registrarse, manteniendo la intención del usuario
 * (ej. volver al lote que quería apartar).
 */
export function RegistroCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isLoading } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/home';

  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await register({
        name: formData.nombre,
        email: formData.email,
        phone: formData.telefono,
        password: formData.password
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('confirma') || message.includes('Confirma') || message.includes('email')) {
        setPendingConfirmation(true);
      } else {
        setError(message || 'No se pudo completar el registro. Intenta de nuevo.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)] md:min-h-[80vh] py-6 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-8">
        <div className="text-center mb-6 md:mb-8">
          <div className="mx-auto h-12 w-12 bg-teal-700 rounded-xl flex items-center justify-center text-white mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Crear cuenta</h2>
          <p className="text-sm text-gray-600 mt-2">
            Regístrate para acceder a tu portal de cliente
          </p>
        </div>

        {pendingConfirmation ? (
          <div className="text-center space-y-4">
            <div className="bg-teal-50 border border-teal-200 text-teal-800 text-sm rounded-lg px-4 py-4">
              <p className="font-medium mb-1">¡Cuenta creada!</p>
              <p>Revisa tu correo <strong>{formData.email}</strong> y confirma tu cuenta para iniciar sesión.</p>
            </div>
            <Link to="/login" className="block text-sm text-teal-700 hover:underline">
              Ir a inicio de sesión
            </Link>
          </div>
        ) : (
        <form className="space-y-5 md:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="nombre"
                required
                autoComplete="name"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Juan Pérez"
                value={formData.nombre}
                onChange={handleChange}
              />
            </div>
          </div>

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
                name="email"
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="tu@correo.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="tel"
                name="telefono"
                required
                autoComplete="tel"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="33 1234 5678"
                value={formData.telefono}
                onChange={handleChange}
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
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">¿Ya tienes cuenta? </span>
          <Link
            to={`/login${redirectTo !== '/home' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
            className="font-medium text-teal-600 hover:text-teal-500"
          >
            Inicia sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
