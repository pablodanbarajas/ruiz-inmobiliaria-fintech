// Spanish particles that stay lowercase inside a name ("María de la Luz").
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/**
 * Client names are captured in capitals ("JUAN PÉREZ DE LA O"). Shows them as
 * "Juan Pérez de la O" so greetings and receipts don't read as shouting.
 */
export function formatPersonName(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .toLocaleLowerCase('es-MX')
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && PARTICLES.has(word) ? word : word.charAt(0).toLocaleUpperCase('es-MX') + word.slice(1)
    )
    .join(' ');
}
