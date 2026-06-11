import { createContext, useContext, ReactNode } from 'react'
import { ToastContainer } from '@/components/ui/Toast'
import { useToast, type Toast } from '@/hooks/useToast'

interface ToastContextType {
  toasts: Toast[]
  success: (title: string, message?: string, duration?: number) => void
  error: (title: string, message?: string, duration?: number) => void
  warning: (title: string, message?: string, duration?: number) => void
  info: (title: string, message?: string, duration?: number) => void
  dismissToast: (id: string) => void
  dismissAll: () => void
}

// Crear contexto
const ToastContext = createContext<ToastContextType | undefined>(undefined)

/**
 * Provider que debe envolver la aplicación
 * Típicamente en App.tsx o main.tsx alrededor del root component
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const {
    toasts,
    success,
    error,
    warning,
    info,
    dismissToast,
    dismissAll,
  } = useToast()

  return (
    <ToastContext.Provider value={{ toasts, success, error, warning, info, dismissToast, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} position="bottom-right" />
    </ToastContext.Provider>
  )
}

/**
 * Hook para usar toasts en cualquier componente
 * Debe estar dentro del ToastProvider
 */
export const useToastContext = (): ToastContextType => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error(
      'useToastContext debe ser usado dentro de un ToastProvider. ' +
      'Asegúrate de que ToastProvider envuelve tu aplicación (típicamente en App.tsx)'
    )
  }
  return context
}

// Export de comodidad - alias más corto
export const useToastNotification = useToastContext
