import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { Toast } from '@/hooks/useToast'

interface ToastProps {
  toast: Toast
  onDismiss: (id: string) => void
}

/**
 * Componente individual Toast
 * Se muestra con icono, titulo, mensaje y botón de cerrar
 */
export const ToastItem = ({ toast, onDismiss }: ToastProps) => {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, toast.id, onDismiss])

  const baseClasses =
    'flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-in slide-in-from-top-2 duration-300'

  const getStyleClasses = () => {
    switch (toast.type) {
      case 'success':
        return `${baseClasses} bg-green-50 border-green-200 text-green-900`
      case 'error':
        return `${baseClasses} bg-red-50 border-red-200 text-red-900`
      case 'warning':
        return `${baseClasses} bg-amber-50 border-amber-200 text-amber-900`
      case 'info':
        return `${baseClasses} bg-blue-50 border-blue-200 text-blue-900`
      default:
        return baseClasses
    }
  }

  const getIcon = () => {
    const iconProps = {
      size: 20,
      className: 'flex-shrink-0 mt-0.5',
    }

    switch (toast.type) {
      case 'success':
        return <CheckCircle2 {...iconProps} className={`${iconProps.className} text-green-600`} />
      case 'error':
        return <AlertCircle {...iconProps} className={`${iconProps.className} text-red-600`} />
      case 'warning':
        return <AlertTriangle {...iconProps} className={`${iconProps.className} text-amber-600`} />
      case 'info':
        return <Info {...iconProps} className={`${iconProps.className} text-blue-600`} />
      default:
        return null
    }
  }

  return (
    <div className={getStyleClasses()}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
        {toast.message && <p className="text-sm mt-1 opacity-90">{toast.message}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Cerrar notificación"
      >
        <X size={18} />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}

/**
 * Contenedor de toasts
 * Renderiza todos los toasts en posición fija
 */
export const ToastContainer = ({
  toasts,
  onDismiss,
  position = 'bottom-right',
}: ToastContainerProps) => {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
  }

  return (
    <div
      className={`fixed z-50 ${positionClasses[position]} flex flex-col gap-3 pointer-events-none max-w-xs`}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
