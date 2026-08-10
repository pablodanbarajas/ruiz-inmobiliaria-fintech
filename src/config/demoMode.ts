/**
 * Demo mode: when non-empty, the entire app filters data
 * to only show information belonging to those desarrolloids.
 * Set to an empty array [] to show all data.
 * Controlled via VITE_ALLOWED_DESARROLLOIDS env var (comma-separated IDs).
 */
const _envIds = import.meta.env.VITE_ALLOWED_DESARROLLOIDS
const _parsed = _envIds ? String(_envIds).split(',').map(Number).filter(Boolean) : []
export const DEMO_DESARROLLOIDS: number[] = _parsed.length > 0 ? _parsed : [11, 20]
