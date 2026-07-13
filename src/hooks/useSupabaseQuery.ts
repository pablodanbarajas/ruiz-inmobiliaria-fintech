import { useState, useEffect } from 'react'
import { getCached, setCached } from '@/lib/queryCache'

interface UseSupabaseQueryOptions {
  enabled?: boolean
  /** Cache key — if provided, results are cached for 5 min and served instantly on re-mount */
  cacheKey?: string
  cacheTtlMs?: number
}

export const useSupabaseQuery = <T,>(
  query: () => Promise<T>,
  deps: any[] = [],
  options: UseSupabaseQueryOptions = {}
) => {
  const { enabled = true, cacheKey, cacheTtlMs } = options

  // Initialise with cached data if available — avoids loading flash on re-navigation
  const [data, setData] = useState<T | null>(() =>
    cacheKey ? getCached<T>(cacheKey, cacheTtlMs) : null
  )
  const [loading, setLoading] = useState(() =>
    cacheKey ? getCached(cacheKey, cacheTtlMs) === null : true
  )
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }

    // Skip fetch if we already have fresh cached data
    if (cacheKey && getCached(cacheKey, cacheTtlMs) !== null) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await query()
        setData(result)
        if (cacheKey) setCached(cacheKey, result)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [enabled, ...deps])

  const refetch = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await query()
      setData(result)
      if (cacheKey) setCached(cacheKey, result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, refetch }
}

