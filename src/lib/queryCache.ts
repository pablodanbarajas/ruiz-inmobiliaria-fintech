/**
 * In-memory query cache — professional approach:
 * - No TTL: data lives until browser page refresh or explicit invalidation
 * - Invalidate on mutations (create/update/delete)
 * - "Recargar" buttons force a fresh fetch
 *
 * This mirrors how tools like Notion, Linear and GitHub handle client-side caching.
 */

interface Entry<T> {
  data: T
  ts: number
}

const store = new Map<string, Entry<any>>()

/** Returns cached data (no expiry — lives until invalidated or page reload) */
export function getCached<T>(key: string, _ttl?: number): T | null {
  const entry = store.get(key)
  if (!entry) return null
  return entry.data as T
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() })
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) { store.clear(); return }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key)
  }
}

/**
 * Re-fetch on window focus after >10 min of inactivity.
 * Use only for financially critical sections (Tesorería, Dashboard).
 * Call this hook in the component and pass the refetch function.
 */
export function onFocusRefetch(refetch: () => void, keyPrefix: string, inactivityMs = 10 * 60 * 1000): () => void {
  const handler = () => {
    const entry = store.get(keyPrefix)
    const stale = !entry || (Date.now() - entry.ts > inactivityMs)
    if (stale) {
      invalidateCache(keyPrefix)
      refetch()
    }
  }
  window.addEventListener('focus', handler)
  return () => window.removeEventListener('focus', handler)
}

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  _ttl?: number
): Promise<T> {
  const cached = getCached<T>(key)
  if (cached !== null) return cached
  const data = await fetcher()
  setCached(key, data)
  return data
}
