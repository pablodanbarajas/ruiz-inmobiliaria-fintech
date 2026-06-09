import { supabase } from '@/lib/supabaseClient'

export const syncExpiredConvenios = async () => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { updated: 0 }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-convenio-status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      }
    )

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error ?? 'No se pudo sincronizar el estado de convenios')
    }

    return { updated: Number(result.updated ?? 0) }
  } catch (error) {
    console.warn('syncExpiredConvenios fallback/error:', error)
    return { updated: 0 }
  }
}
