import { Mail, Phone, MapPin, Clock, MessageCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { CONTACTO, emailHref, whatsappHref } from '../../config/contacto';

// Support works through phone and WhatsApp, where the team follows up fastest.
// The portal no longer stores messages: no one in the admin panel read them.
export function SoporteContent() {
  const { session } = useAuth();
  const isAuthenticated = session.isAuthenticated;
  const userName = session.user?.name ?? null;
  const email = session.user?.email ?? null;

  const mensajeWhatsapp = isAuthenticated
    ? `Hola, soy ${userName ?? 'cliente'}${email ? ` (${email})` : ''}. Necesito ayuda con `
    : 'Hola, me interesa información sobre ';

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 leading-tight">
          {isAuthenticated ? `¿En qué te ayudamos, ${userName ?? 'cliente'}?` : 'Soporte'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pagos, estado de tus lotes, desarrollos o cualquier duda: escríbenos por WhatsApp o llámanos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <a
          href={whatsappHref(mensajeWhatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl bg-green-600 hover:bg-green-700 text-white p-5 md:p-6 shadow-sm transition-colors"
        >
          <span className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold">Escríbenos por WhatsApp</span>
            <span className="block text-sm text-green-50">{CONTACTO.telefonoVisible} · respuesta más rápida</span>
          </span>
        </a>

        <a
          href={CONTACTO.telefonoHref}
          className="group flex items-center gap-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white p-5 md:p-6 shadow-sm transition-colors"
        >
          <span className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Phone className="w-6 h-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold">Llámanos</span>
            <span className="block text-sm text-teal-50">{CONTACTO.telefonoVisible}</span>
          </span>
        </a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm text-gray-600">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-teal-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-800">Horario de atención</p>
              <p>{CONTACTO.horario}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-teal-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-800">Oficina</p>
              <p>{CONTACTO.direccion}</p>
              <a href={CONTACTO.mapaHref} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
                Cómo llegar
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-teal-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-800">Correo</p>
              <a href={emailHref('Consulta desde el portal')} className="text-teal-700 hover:underline break-all">
                {CONTACTO.email}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
