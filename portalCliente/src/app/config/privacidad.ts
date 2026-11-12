/**
 * Privacy notice the client accepts when registering or creating a password.
 * When legal issues a new revision: update the version, the PDF and the page
 * text (pages/public/AvisoPrivacidad.tsx).
 */
export const AVISO_PRIVACIDAD = {
  version: 'JU-FO-001 REV 0',
  pdfHref: `${import.meta.env.BASE_URL}docs/aviso-de-privacidad-JU-FO-001-rev0.pdf`,
  ruta: '/aviso-de-privacidad',
} as const;

/**
 * Consent stored in the account's metadata: which notice version was
 * accepted, when, and whether the client opposed the secondary purposes
 * (marketing, events, surveys).
 */
export function privacyConsent(rechazaFinalidadesSecundarias: boolean) {
  return {
    aviso_privacidad_version: AVISO_PRIVACIDAD.version,
    aviso_privacidad_aceptado_at: new Date().toISOString(),
    rechaza_finalidades_secundarias: rechazaFinalidadesSecundarias,
  };
}
