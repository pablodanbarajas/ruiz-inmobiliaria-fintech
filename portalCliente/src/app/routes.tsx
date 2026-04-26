import { createBrowserRouter } from 'react-router';
import { PublicLayout } from './layouts/PublicLayout';
import { ClientLayout } from './layouts/ClientLayout';
import { ClientRoute } from './guards/ClientRoute';

import { Home } from './pages/public/Home';
import { Soporte } from './pages/public/Soporte';
import { LoginCliente } from './pages/public/LoginCliente';
import { RegistroCliente } from './pages/public/RegistroCliente';
import { MapaDesarrollo } from './pages/public/MapaDesarrollo';

import { PortalHome } from './pages/client/PortalHome';
import { PortalSoporte } from './pages/client/PortalSoporte';
import { MisLotes } from './pages/client/MisLotes';
import { MisPagos } from './pages/client/MisPagos';

export const router = createBrowserRouter([
  // Rutas públicas
  {
    path: '/',
    Component: PublicLayout,
    children: [
      {
        index: true,
        Component: Home
      },
      {
        path: 'soporte',
        Component: Soporte
      },
      {
        path: 'login',
        Component: LoginCliente
      },
      {
        path: 'registro',
        Component: RegistroCliente
      },
      {
        path: 'desarrollos/:id/mapa',
        Component: MapaDesarrollo
      }
    ]
  },

  // Rutas privadas de cliente
  {
    path: '/portal',
    Component: ClientRoute,
    children: [
      {
        Component: ClientLayout,
        children: [
          {
            index: true,
            Component: PortalHome       
          },
          {
            path: 'mis-lotes',
            Component: MisLotes
          },
          {
            path: 'mis-pagos',
            Component: MisPagos
          },
          {
            path: 'soporte',
            Component: PortalSoporte
          }
        ]
      }
    ]
  }
]);