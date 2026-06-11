import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number // ms, 0 = never auto-dismiss
}

interface UseToastReturn {
  toasts: Toast[]
  showToast: (type: Toast['type'], title: string, message?: string, duration?: number) => void
  success: (title: string, message?: string, duration?: number) => void
  error: (title: string, message?: string, duration?: number) => void
  warning: (title: string, message?: string, duration?: number) => void
  info: (title: string, message?: string, duration?: number) => void
  dismissToast: (id: string) => void
  dismissAll: () => void
}

export const useToast = (initialToasts: Toast[] = []): UseToastReturn => {
  const [toasts, setToasts] = useState<Toast[]>(initialToasts)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (
      type: Toast['type'],
      title: string,
      message?: string,
      duration: number = 5000
    ) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      const toast: Toast = { id, type, title, message, duration }

      setToasts((prev) => [...prev, toast])

      // Auto-dismiss if duration > 0
      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration)
      }
    },
    [dismissToast]
  )

  const success = useCallback(
    (title: string, message?: string, duration = 5000) =>
      showToast('success', title, message, duration),
    [showToast]
  )

  const error = useCallback(
    (title: string, message?: string, duration = 7000) =>
      showToast('error', title, message, duration),
    [showToast]
  )

  const warning = useCallback(
    (title: string, message?: string, duration = 6000) =>
      showToast('warning', title, message, duration),
    [showToast]
  )

  const info = useCallback(
    (title: string, message?: string, duration = 5000) =>
      showToast('info', title, message, duration),
    [showToast]
  )

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  return {
    toasts,
    showToast,
    success,
    error,
    warning,
    info,
    dismissToast,
    dismissAll,
  }
}
