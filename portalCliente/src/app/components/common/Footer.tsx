import { MapPin, Phone, Mail, MessageCircle } from 'lucide-react';
import { Marca } from './Marca';
import { Link } from 'react-router';
import { CONTACTO, whatsappHref } from '../../config/contacto';
import { useAuth } from '../../hooks/useAuth';
import { AVISO_PRIVACIDAD } from '../../config/privacidad';

export function Footer() {
  const { session } = useAuth();
  return (
    <footer className="bg-marca-negro text-gray-300 mt-auto border-t-4 border-marca-oro">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-1">
            <div className="mb-4">
              <Marca fondo="oscuro" size="lg" />
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
                  <li><Link to="/home" className="hover:text-marca-oro transition-colors">Inicio</Link></li>
                  <li><Link to="/mis-lotes" className="hover:text-marca-oro transition-colors">Mis lotes</Link></li>
                  <li><Link to="/mis-pagos" className="hover:text-marca-oro transition-colors">Mis pagos</Link></li>
                  <li><Link to="/portal-soporte" className="hover:text-marca-oro transition-colors">Soporte</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/" className="hover:text-marca-oro transition-colors">Desarrollos disponibles</Link></li>
                  <li><Link to="/login" className="hover:text-marca-oro transition-colors">Iniciar sesión</Link></li>
                  <li><Link to="/forgot-password" className="hover:text-marca-oro transition-colors">Crear o recuperar contraseña</Link></li>
                  <li><Link to="/soporte" className="hover:text-marca-oro transition-colors">Soporte</Link></li>
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
                  className="flex items-start gap-2 hover:text-marca-oro transition-colors"
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
                  className="flex items-center gap-2 hover:text-marca-oro transition-colors"
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <span>WhatsApp {CONTACTO.telefonoVisible}</span>
                </a>
              </li>
              <li>
                <a href={CONTACTO.telefonoHref} className="flex items-center gap-2 hover:text-marca-oro transition-colors">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{CONTACTO.telefonoVisible}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACTO.email}`} className="flex items-center gap-2 hover:text-marca-oro transition-colors">
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
            <Link to={AVISO_PRIVACIDAD.ruta} className="hover:text-marca-oro transition-colors underline">
              Aviso de privacidad
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
