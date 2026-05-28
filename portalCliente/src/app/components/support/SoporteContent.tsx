import { useState } from 'react';
import { Mail, Phone, MapPin, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supportService } from '../../services';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function SoporteContent() {
  const { session } = useAuth();
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const isAuthenticated = session.isAuthenticated;
  const userName = session.user?.name ?? null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState('loading');

    try {
      await supportService.createTicket({
        name: form.name,
        email: form.email,
        message: form.message,
        clientId: session.user?.id
      });
      setSubmitState('success');
      setForm({ name: '', email: '', message: '' });
    } catch {
      setSubmitState('error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800 leading-tight">
          {isAuthenticated ? `Soporte para ${userName ?? 'Cliente'}` : 'Soporte'}
        </h1>
        <p className="text-xs text-gray-500">
          Estamos para ayudarte con dudas sobre desarrollos, lotes, pagos o seguimiento.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Envíanos un mensaje
          </h2>

          {submitState === 'success' ? (
            <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-lg px-5 py-6 text-center">
              <p className="font-semibold text-lg mb-1">Mensaje enviado</p>
              <p className="text-sm">Nos pondremos en contacto contigo a la brevedad.</p>
              <button
                onClick={() => setSubmitState('idle')}
                className="mt-4 text-sm text-teal-700 underline"
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {submitState === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  Ocurrió un error al enviar tu mensaje. Intenta de nuevo.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Escribe tu nombre"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Cuéntanos cómo podemos ayudarte"
                  value={form.message}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitState === 'loading'}
                className="flex items-center gap-2 bg-teal-700 text-white px-6 py-2 rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {submitState === 'loading' ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Información de contacto
            </h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-teal-700 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Teléfono</p>
                  <p>+52 33 1234 5678</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-teal-700 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Correo</p>
                  <p>contacto@ruizinmobiliaria.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-teal-700 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Oficina</p>
                  <p>Guadalajara, Jalisco, México</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-teal-700 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">Horario de atención</p>
                  <p>Lunes a viernes de 9:00 a 18:00 hrs</p>
                </div>
              </div>
            </div>
          </div>

          {isAuthenticated && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                Atención a clientes
              </h2>
              <p className="text-sm text-gray-600">
                Si ya eres cliente, podemos ayudarte con seguimiento de pagos,
                estado de tus lotes y dudas sobre tu cuenta.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
