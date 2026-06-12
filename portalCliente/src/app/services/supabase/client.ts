import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

if (!env.isSupabaseConfigured()) {
  throw new Error(
    'Supabase no está configurado. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env'
  );
}

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      // Evitar rehydrate automático que causa race conditions
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);