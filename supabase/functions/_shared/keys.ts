// Supabase API keys for Edge Functions.
//
// The project is moving from the legacy JWT keys (anon / service_role) to the
// new publishable / secret keys, which can be rotated or revoked one by one.
// Supabase injects the new ones as JSON objects keyed by name; the key created
// first is named "default". Until a project has the new keys, fall back to the
// legacy variables so the functions work before and after the switch.

const readNamedKey = (variable: string, legacyVariable: string): string => {
  const raw = Deno.env.get(variable)
  if (raw) {
    try {
      const key = JSON.parse(raw)?.default
      if (typeof key === 'string' && key) return key
    } catch {
      // Malformed value: use the legacy key below.
    }
  }
  return Deno.env.get(legacyVariable) ?? ''
}

/** Full-access key (bypasses RLS). Only for server-side work inside functions. */
export const getSecretKey = (): string => readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')

/** Low-privilege key, for clients that act as the calling user (RLS applies). */
export const getPublishableKey = (): string => readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
