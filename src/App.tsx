import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

function App() {
  return (
    <BrowserRouter>
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
            <ProtectedRoute>
              <Desarrollos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/desarrollos/:id"
          element={
            <ProtectedRoute>
              <DesarrolloDetail />
            </ProtectedRoute>
          }
        />

        {/* Lotes */}
        <Route
          path="/admin/lotes"
          element={
            <ProtectedRoute>
              <Lotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/lotes/:id"
          element={
            <ProtectedRoute>
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

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
