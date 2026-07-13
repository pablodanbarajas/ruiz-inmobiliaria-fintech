import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Saves scroll position per pathname so navigating back to a section
// restores where you were, instead of always jumping to the top.
// Keyed by pathname (not location.key) so forward navigation also restores.
const scrollPositions = new Map<string, number>()

export function ScrollRestorer() {
  const { pathname } = useLocation()
  const prevPathname = useRef<string | null>(null)

  useEffect(() => {
    // Save previous page's scroll before switching
    if (prevPathname.current && prevPathname.current !== pathname) {
      scrollPositions.set(prevPathname.current, window.scrollY)
    }

    // Restore saved position for this page, or go to top if first visit
    const saved = scrollPositions.get(pathname)
    window.scrollTo({ top: saved ?? 0, behavior: 'instant' })

    prevPathname.current = pathname

    // Also save on unmount in case of programmatic navigation
    return () => {
      scrollPositions.set(pathname, window.scrollY)
    }
  }, [pathname])

  return null
}
