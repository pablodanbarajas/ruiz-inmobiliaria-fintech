import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../services/supabase/client';
import { AVISO_PRIVACIDAD, privacyConsent } from '../../config/privacidad';
import { ConsentimientoPrivacidad } from './ConsentimientoPrivacidad';

/**
 * Clients who signed up before the portal asked for consent, or who accepted
 * an older version of the notice, accept the current one once, here. It stays
 * open until they accept; the portal shows behind it.
 */
export function AvisoPrivacidadGate() {
  const [pendiente, setPendiente] = useState(false);
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [rechazaSecundarias, setRechazaSecundarias] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    supabase.auth.getUser().then(({ data }) => {
      const version = data.user?.user_metadata?.aviso_privacidad_version;
      if (activo && data.user && version !== AVISO_PRIVACIDAD.version) setPendiente(true);
    });
    return () => {
      activo = false;
    };
  }, []);

  if (!pendiente) return null;

  const aceptar = async () => {
    setGuardando(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ data: privacyConsent(rechazaSecundarias) });
    setGuardando(false);
    if (updateError) {
      setError('No se pudo guardar tu aceptación. Inténtalo de nuevo.');
      return;
    }
    setPendiente(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="aviso-gate-titulo">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck className="w-7 h-7 text-teal-700 flex-shrink-0" />
          <h2 id="aviso-gate-titulo" className="text-lg font-semibold text-gray-900">Aviso de Privacidad</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Actualizamos el portal y necesitamos que revises y aceptes nuestro Aviso de Privacidad para seguir
          atendiéndote. Explica qué datos tratamos, para qué y cómo ejercer tus derechos.
        </p>

        <ConsentimientoPrivacidad
          aceptaAviso={aceptaAviso}
          onAceptaAviso={setAceptaAviso}
          rechazaSecundarias={rechazaSecundarias}
          onRechazaSecundarias={setRechazaSecundarias}
        />

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={aceptar}
          disabled={!aceptaAviso || guardando}
          className="mt-5 w-full rounded-lg bg-teal-700 hover:bg-teal-800 text-white py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {guardando ? 'Guardando...' : 'Aceptar y continuar'}
        </button>
      </div>
    </div>
  );
}
