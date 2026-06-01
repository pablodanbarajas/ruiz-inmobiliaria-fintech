import { useState, useEffect } from 'react'

/**
 * Like useState for filter objects, but persists to localStorage so
 * the values survive back-navigation within the same browser session.
 */
export function usePersistedFilters<T extends Record<string, string>>(
  key: string,
  defaults: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [filters, setFilters] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) return { ...defaults, ...JSON.parse(saved) }
    } catch {}
    return defaults
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(filters))
  }, [key, filters])

  return [filters, setFilters]
}
