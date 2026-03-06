import { useState, useEffect } from 'react'

interface UseSupabaseQueryOptions {
  enabled?: boolean
}

export const useSupabaseQuery = <T,>(
  query: () => Promise<T>,
  deps: any[] = [],
  options: UseSupabaseQueryOptions = {}
) => {
  const { enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await query()
        setData(result)
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, refetch }
}
