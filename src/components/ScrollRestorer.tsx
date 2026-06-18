import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Mapa en memoria: location.key → scrollY
// location.key es único por cada entrada en el historial del navegador,
// así que ir "atrás" restaura exactamente la posición correcta.
const scrollPositions = new Map<string, number>()

export function ScrollRestorer() {
  const { key } = useLocation()

  useEffect(() => {
    // Al entrar a esta ruta: restaurar posición guardada, o ir al tope
    const saved = scrollPositions.get(key)
    if (saved !== undefined) {
      window.scrollTo({ top: saved, behavior: 'instant' })
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    // Al salir de esta ruta: guardar posición actual
    return () => {
      scrollPositions.set(key, window.scrollY)
    }
  }, [key])

  return null
}
