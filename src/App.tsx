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
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Desarrollos */}
        <Route
          path="/admin/desarrollos"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Desarrollos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/desarrollos/:id"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesarrolloDetail />
            </ProtectedRoute>
          }
        />

        {/* Lotes */}
        <Route
          path="/admin/lotes"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Lotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/lotes/:id"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <LoteDetail />
            </ProtectedRoute>
          }
        />

        {/* Clientes */}
        <Route
          path="/admin/clientes"
          element={
            <ProtectedRoute>
              <Clientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clientes/:id"
          element={
            <ProtectedRoute>
              <ClienteDetail />
            </ProtectedRoute>
          }
        />

        {/* Ventas */}
        <Route
          path="/admin/ventas"
          element={
            <ProtectedRoute>
              <Ventas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ventas/:id"
          element={
            <ProtectedRoute>
              <VentaDetail />
            </ProtectedRoute>
          }
        />

        {/* Pagos */}
        <Route
          path="/admin/pagos"
          element={
            <ProtectedRoute>
              <Pagos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/pagos/:id"
          element={
            <ProtectedRoute>
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

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
