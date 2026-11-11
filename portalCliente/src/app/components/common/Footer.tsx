import { MapPin, Phone, Mail, Building2, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { CONTACTO, whatsappHref } from '../../config/contacto';
import { useAuth } from '../../hooks/useAuth';
import { AVISO_PRIVACIDAD } from '../../config/privacidad';

export function Footer() {
  const { session } = useAuth();
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-teal-700 text-white rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-white font-bold text-lg">Ruiz Inmobiliaria</span>
            </div>
            <p className="text-sm text-gray-400">
              Tu socio de confianza en bienes raíces. Más de 15 años ayudando a familias a encontrar su hogar ideal.
            </p>
          </div>

          {/* Only links that lead somewhere. The old "Nosotros" and "Proyectos"
              lists pointed to "#" and had hand-typed development names. */}
          <div>
            <h3 className="text-white font-semibold mb-4">Portal</h3>
            <ul className="space-y-2 text-sm">
              {session.isAuthenticated ? (
                <>
                  <li><Link to="/home" className="hover:text-amber-500 transition-colors">Inicio</Link></li>
                  <li><Link to="/mis-lotes" className="hover:text-amber-500 transition-colors">Mis lotes</Link></li>
                  <li><Link to="/mis-pagos" className="hover:text-amber-500 transition-colors">Mis pagos</Link></li>
                  <li><Link to="/portal-soporte" className="hover:text-amber-500 transition-colors">Soporte</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/" className="hover:text-amber-500 transition-colors">Desarrollos disponibles</Link></li>
                  <li><Link to="/login" className="hover:text-amber-500 transition-colors">Iniciar sesión</Link></li>
                  <li><Link to="/forgot-password" className="hover:text-amber-500 transition-colors">Crear o recuperar contraseña</Link></li>
                  <li><Link to="/soporte" className="hover:text-amber-500 transition-colors">Soporte</Link></li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Contacto</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={CONTACTO.mapaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 hover:text-amber-500 transition-colors"
                >
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{CONTACTO.direccion} · Cómo llegar</span>
                </a>
              </li>
              <li>
                <a
                  href={whatsappHref('Hola, me interesa información sobre ')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-amber-500 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <span>WhatsApp {CONTACTO.telefonoVisible}</span>
                </a>
              </li>
              <li>
                <a href={CONTACTO.telefonoHref} className="flex items-center gap-2 hover:text-amber-500 transition-colors">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{CONTACTO.telefonoVisible}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACTO.email}`} className="flex items-center gap-2 hover:text-amber-500 transition-colors">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="break-all">{CONTACTO.email}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400 space-y-2">
          <p>&copy; {new Date().getFullYear()} Ruiz Inmobiliaria. Todos los derechos reservados.</p>
          <p>
            <Link to={AVISO_PRIVACIDAD.ruta} className="hover:text-amber-500 transition-colors underline">
              Aviso de privacidad
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
