/**
 * Cliente Supabase para queries públicas (sin autenticación)
 * 
 * Uso:
 *   - getPublicDevelopments()
 *   - Otros queries que no requieren auth
 * 
 * Por qué separado:
 *   El cliente principal tiene listeners de auth que pueden causar
 *   race conditions con otros queries. Este cliente es puro y sin listeners.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

if (!env.isSupabaseConfigured()) {
  throw new Error(
    'Supabase no está configurado. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env'
  );
}

export const publicSupabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);
