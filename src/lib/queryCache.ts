/**
 * Lightweight in-memory query cache with TTL.
 * Lives at module level → survives React navigation without re-fetching.
 * Default TTL: 5 minutes. "Recargar" buttons should call invalidate().
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 min

interface Entry<T> {
  data: T
  ts: number
}

const store = new Map<string, Entry<any>>()

export function getCached<T>(key: string, ttl = DEFAULT_TTL_MS): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > ttl) { store.delete(key); return null }
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
 * Wraps an async fetch function with cache.
 * Returns cached value immediately if fresh; otherwise fetches and caches.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCached<T>(key, ttl)
  if (cached !== null) return cached
  const data = await fetcher()
  setCached(key, data)
  return data
}
