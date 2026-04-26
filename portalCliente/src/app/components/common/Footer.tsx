import { MapPin, Phone, Mail, Building2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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

          <div>
            <h3 className="text-white font-semibold mb-4">Nosotros</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-amber-500 transition-colors">Quiénes somos</a></li>
              <li><a href="#" className="hover:text-amber-500 transition-colors">Nuestra historia</a></li>
              <li><a href="#" className="hover:text-amber-500 transition-colors">Misión y visión</a></li>
              <li><a href="#" className="hover:text-amber-500 transition-colors">Testimonios</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Proyectos</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-amber-500 transition-colors">Pueblo de Barrancas</a></li>
              <li><a href="#" className="hover:text-amber-500 transition-colors">Vistas del Cielo</a></li>
              <li><a href="#" className="hover:text-amber-500 transition-colors">Senderos de San Miguel</a></li>
              <li><a href="#" className="hover:text-amber-500 transition-colors">Senderos de Piedra</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Contacto</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Av. Principal #123, Guadalajara, Jalisco, México</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>+52 33 1234 5678</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>contacto@ruizinmobiliaria.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Ruiz Inmobiliaria. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
