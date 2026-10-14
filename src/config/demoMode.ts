/**
 * Demo mode: when non-empty, the entire app filters data
 * to only show information belonging to those desarrolloids.
 * The admin-specific variable takes precedence, while the legacy variable
 * remains a fallback for existing deployments.
 */
const _envIds =
  import.meta.env.VITE_ADMIN_ALLOWED_DESARROLLOIDS ||
  import.meta.env.VITE_ALLOWED_DESARROLLOIDS
const _parsed = _envIds
  ? String(_envIds).split(',').map(Number).filter(Boolean)
  : []

export const DEMO_DESARROLLOIDS: number[] = _parsed.length > 0 ? _parsed : [11, 20]
