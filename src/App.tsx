import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/admin/Dashboard'
import { Desarrollos } from '@/pages/admin/Desarrollos'
import { DesarrolloDetail } from '@/pages/admin/DesarrolloDetail'
import { Lotes } from '@/pages/admin/Lotes'
import { LoteDetail } from '@/pages/admin/LoteDetail'
import { Clientes } from '@/pages/admin/Clientes'
import { ClienteDetail } from '@/pages/admin/ClienteDetail'
import { Ventas } from '@/pages/admin/Ventas'
import { VentaDetail } from '@/pages/admin/VentaDetail'
import { Pagos } from '@/pages/admin/Pagos'
import { PagoDetail } from '@/pages/admin/PagoDetail'
import { Convenios } from '@/pages/admin/Convenios'
import { ConvenioDetail } from '@/pages/admin/ConvenioDetail'
import { CargosExtra } from '@/pages/admin/CargosExtra'
import { Traspasos } from '@/pages/admin/Traspasos'
import { Mapa } from '@/pages/admin/Mapa'
import { InvitarClientes } from '@/pages/admin/InvitarClientes'
import { UsuariosAdmin } from '@/pages/admin/UsuariosAdmin'
import { ADMIN_PANEL_ROLES } from '@/config/roles'

const ROLES_VER_DESARROLLOS = ['admin', 'finanzas'] as const
const ROLES_EDITAR_CLIENTES = ['admin', 'contratos'] as const
const ROLES_EDITAR_VENTAS = ['admin', 'contratos', 'cobranza_caja'] as const
const ROLES_PAGOS = ['admin', 'finanzas', 'contratos', 'cobranza_caja'] as const

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={[...ADMIN_PANEL_ROLES]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Desarrollos */}
        <Route
          path="/admin/desarrollos"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_VER_DESARROLLOS]}>
              <Desarrollos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/desarrollos/:id"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_VER_DESARROLLOS]}>
              <DesarrolloDetail />
            </ProtectedRoute>
          }
        />

        {/* Lotes */}
        <Route
          path="/admin/lotes"
          element={
            <ProtectedRoute allowedRoles={[...ADMIN_PANEL_ROLES]}>
              <Lotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/lotes/:id"
          element={
            <ProtectedRoute allowedRoles={[...ADMIN_PANEL_ROLES]}>
              <LoteDetail />
            </ProtectedRoute>
          }
        />

        {/* Clientes */}
        <Route
          path="/admin/clientes"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_EDITAR_CLIENTES]}>
              <Clientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clientes/:id"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_EDITAR_CLIENTES]}>
              <ClienteDetail />
            </ProtectedRoute>
          }
        />

        {/* Ventas */}
        <Route
          path="/admin/ventas"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_EDITAR_VENTAS]}>
              <Ventas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ventas/:id"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_EDITAR_VENTAS]}>
              <VentaDetail />
            </ProtectedRoute>
          }
        />

        {/* Pagos */}
        <Route
          path="/admin/pagos"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_PAGOS]}>
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/pagos/:id"
          element={
            <ProtectedRoute allowedRoles={[...ROLES_PAGOS]}>
              <PagoDetail />
            </ProtectedRoute>
          }
        />

        {/* Convenios */}
        <Route
          path="/admin/convenios"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Convenios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/convenios/:id"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ConvenioDetail />
            </ProtectedRoute>
          }
        />

        {/* Cargos Extra */}
        <Route
          path="/admin/cargos-extra"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CargosExtra />
            </ProtectedRoute>
          }
        />

        {/* Traspasos */}
        <Route
          path="/admin/traspasos"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Traspasos />
            </ProtectedRoute>
          }
        />

        {/* Mapa */}
        <Route
          path="/admin/mapa"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Mapa />
            </ProtectedRoute>
          }
        />

        {/* Portal - Invitaciones */}
        <Route
          path="/admin/invitar-clientes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InvitarClientes />
            </ProtectedRoute>
          }
        />

        {/* Administracion de usuarios */}
        <Route
          path="/admin/usuarios"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsuariosAdmin />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
