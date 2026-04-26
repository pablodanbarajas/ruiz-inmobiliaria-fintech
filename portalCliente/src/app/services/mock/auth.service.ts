import type { IAuthService } from '../interfaces';
import type { AuthSession, LoginCredentials } from '../../types/auth.types';
import { mockAuthSession, mockGuestSession } from '../../data/mock/auth.mock';

/**
 * Implementación mock del servicio de autenticación.
 *
 * Simula una sesión activa en memoria.
 * Para activar auth real: implementar SupabaseAuthService con la misma interfaz
 * y reemplazar la exportación en services/index.ts.
 */

// Estado mutable local — solo en implementación mock, nunca en la real.
let _session: AuthSession = { ...mockAuthSession };

export const mockAuthService: IAuthService = {
  getSession(): AuthSession {
    return _session;
  },

  async login(_credentials: LoginCredentials): Promise<AuthSession> {
    // Mock: cualquier credencial válida inicia sesión como el usuario de prueba.
    _session = { ...mockAuthSession };
    return _session;
  },

  async logout(): Promise<void> {
    _session = { ...mockGuestSession };
  }
};
