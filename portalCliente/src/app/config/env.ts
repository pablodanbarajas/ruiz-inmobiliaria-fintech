/**
 * Acceso centralizado a variables de entorno.
 *
 * Reglas de seguridad:
 *   - Todas las variables de entorno del frontend deben tener prefijo VITE_
 *   - NUNCA incluir service_role key aquí — solo en backend/Edge Functions
 *   - Si una variable requerida no está definida, se lanza error temprano
 *     para evitar comportamientos silenciosos en producción
 *
 * Uso:
 *   import { env } from '../config/env';
 *   const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
 */

function requireEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Variable de entorno requerida no definida: ${key}\n` +
      `Verifica que tu archivo .env esté configurado correctamente.`
    );
  }
  return value;
}

function optionalEnvVar(key: string, fallback = ''): string {
  return import.meta.env[key] ?? fallback;
}

export const env = {
  /**
   * URL del proyecto Supabase.
   * Ejemplo: https://abcdefgh.supabase.co
   */
  SUPABASE_URL: optionalEnvVar('VITE_SUPABASE_URL'),

  /**
   * Clave pública anon de Supabase.
   * Es segura para usar en frontend — el acceso real lo controla RLS.
   * NUNCA usar service_role key aquí.
   */
  SUPABASE_ANON_KEY: optionalEnvVar('VITE_SUPABASE_ANON_KEY'),

  /** Ambiente actual */
  MODE: import.meta.env.MODE as 'development' | 'production' | 'test',

  /** true en desarrollo */
  IS_DEV: import.meta.env.DEV as boolean,

  /** Helpers de validación */
  isSupabaseConfigured(): boolean {
    return Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY);
  }
} as const;
