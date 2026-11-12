import { Link } from 'react-router';
import { AVISO_PRIVACIDAD } from '../../config/privacidad';

type Props = {
  aceptaAviso: boolean;
  onAceptaAviso: (value: boolean) => void;
  rechazaSecundarias: boolean;
  onRechazaSecundarias: (value: boolean) => void;
};

/**
 * Privacy consent for sign-up and password creation. Accepting the notice is
 * required; opposing the secondary purposes (marketing, events, surveys) is
 * the client's choice, as the notice allows.
 */
export function ConsentimientoPrivacidad({ aceptaAviso, onAceptaAviso, rechazaSecundarias, onRechazaSecundarias }: Props) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          required
          checked={aceptaAviso}
          onChange={(e) => onAceptaAviso(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-500"
        />
        <span>
          He leído y acepto el{' '}
          <Link to={AVISO_PRIVACIDAD.ruta} target="_blank" className="font-medium text-teal-700 hover:underline">
            Aviso de Privacidad
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-2 text-gray-600">
        <input
          type="checkbox"
          checked={rechazaSecundarias}
          onChange={(e) => onRechazaSecundarias(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-500"
        />
        <span>No deseo recibir comunicaciones comerciales, promociones, invitaciones a eventos ni encuestas.</span>
      </label>
    </div>
  );
}
