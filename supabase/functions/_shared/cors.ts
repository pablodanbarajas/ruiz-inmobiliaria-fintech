/**
 * CORS helper for Supabase Edge Functions.
 * Restricts allowed origins to the known app domains.
 * Webhooks (quentli-webhook, sync-quentli) should bypass this and use '*'.
 */

const ALLOWED_ORIGINS = [
  'https://ruiz-inmobiliaria-fintech.vercel.app',
  // Portal cliente — actualiza esta URL cuando el portal tenga dominio propio
  'https://ruiz-inmobiliaria-fintech.vercel.app',
  // Dev local
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
]

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}
