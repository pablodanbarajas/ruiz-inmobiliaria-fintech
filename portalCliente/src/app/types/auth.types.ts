/**
 * Tipos canónicos de autenticación y usuario.
 * Única fuente de verdad — no duplicar en mocks ni servicios.
 */

export type UserRole = 'client' | 'admin';

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** URL al avatar generado o subido por el usuario */
  avatarUrl: string | null;
  role: UserRole;
}

export interface AuthSession {
  isAuthenticated: boolean;
  user: ClientUser | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  phone: string;
  password: string;
}
