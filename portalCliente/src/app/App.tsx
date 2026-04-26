import { RouterProvider } from 'react-router';
import { router } from './routes';

/**
 * Componente principal de la aplicación
 * Configura el RouterProvider con las rutas definidas en routes.tsx
 * Este es el punto de entrada de toda la aplicación React
 */
export default function App() {
  return <RouterProvider router={router} />;
}