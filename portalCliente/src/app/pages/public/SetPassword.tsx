import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../services/supabase/client';
import { ConsentimientoPrivacidad } from '../../components/shared/ConsentimientoPrivacidad';
import { PasswordInput } from '../../components/shared/PasswordInput';
import { privacyConsent } from '../../config/privacidad';

export function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [rechazaSecundarias, setRechazaSecundarias] = useState(false);
  const passwordRules = [
    { label: 'Al menos 8 caracteres', test: password.length >= 8 },
    { label: 'Una letra mayúscula', test: /[A-ZÁÉÍÓÚÜÑ]/.test(password) },
    { label: 'Una letra minúscula', test: /[a-záéíóúüñ]/.test(password) },
    { label: 'Un número', test: /\d/.test(password) },
    { label: 'Un carácter especial', test: /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\d]/.test(password) },
  ];
  const isPasswordStrong = passwordRules.every((rule) => rule.test);

  useEffect(() => {
    // Supabase procesa automáticamente el hash #access_token=...
    // de la URL de invitación. Escuchamos onAuthStateChange para
    // saber cuándo la sesión quedó establecida.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        setIsReady(true);
        setIsLoading(false);
      }
    });

    // También revisamos si ya existe sesión (reload de la página)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsReady(true);
      }
      setIsLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordStrong) {
      setError('Completa todos los requisitos de seguridad de la contraseña.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!aceptaAviso) {
      setError('Para continuar necesitas aceptar el Aviso de Privacidad.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Invited clients never see the sign-up form, so they accept the notice here.
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: privacyConsent(rechazaSecundarias),
      });
      if (updateError) throw updateError;
      navigate('/home', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Error al actualizar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Verificando enlace de invitación...</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Enlace inválido o expirado
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            El enlace ya caducó o ya fue utilizado. Pide uno nuevo con tu correo
            y te llegará en unos minutos para crear tu contraseña.
          </p>
          {/* Works for invited clients too: their account exists, only the password is missing. */}
          <button
            onClick={() => navigate('/forgot-password')}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-teal-700 hover:bg-teal-800"
          >
            Enviarme un enlace nuevo
          </button>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 text-teal-600 hover:underline text-sm font-medium"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Establece tu contraseña</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Crea una contraseña segura para acceder a tu portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
            </label>
            <PasswordInput
              withIcon={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crea una contraseña segura"
              required
              autoComplete="new-password"
            />
            <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-label="Requisitos de contraseña">
              {passwordRules.map((rule) => (
                <li key={rule.label} className={rule.test ? 'text-emerald-600' : 'text-gray-500'}>
                  <span className="mr-1 inline-block w-3 text-center font-bold">{rule.test ? '✓' : '○'}</span>
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <PasswordInput
              withIcon={false}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              autoComplete="new-password"
            />
            {confirmPassword && (
              <p className={`mt-1 text-xs ${password === confirmPassword ? 'text-emerald-600' : 'text-red-600'}`}>
                {password === confirmPassword ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.'}
              </p>
            )}
          </div>

          <ConsentimientoPrivacidad
            aceptaAviso={aceptaAviso}
            onAceptaAviso={setAceptaAviso}
            rechazaSecundarias={rechazaSecundarias}
            onRechazaSecundarias={setRechazaSecundarias}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isPasswordStrong || password !== confirmPassword || !aceptaAviso}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar contraseña y entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
