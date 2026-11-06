type Page<T> = { data: T[] | null; error: unknown }

/**
 * Loads every row of a query in pages, past the API's per-request row limit.
 * `fetchPage` must filter by `key > afterKey`, order by that key ascending and
 * limit to `pageSize`. Stops only on an empty page, so a lower server limit
 * cannot silently cut the results short. Throws if any page fails.
 */
export const fetchAllByKey = async <T>(
  fetchPage: (afterKey: number, pageSize: number) => PromiseLike<Page<T>>,
  getKey: (row: T) => number,
  pageSize = 1000,
): Promise<T[]> => {
  const rows: T[] = []
  let afterKey = 0

  while (true) {
    const { data, error } = await fetchPage(afterKey, pageSize)
    if (error) throw error
    if (!data || data.length === 0) return rows
    rows.push(...data)
    afterKey = getKey(data[data.length - 1])
  }
}
