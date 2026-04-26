import { supabase } from './client';
import type { IAuthService } from '../interfaces';
import type { AuthSession, LoginCredentials } from '../../types/auth.types';

function mapSupabaseSession(session: any): AuthSession {
  if (!session?.user) {
    return {
      isAuthenticated: false,
      user: null
    };
  }

  return {
    isAuthenticated: true,
    user: {
      id: session.user.id,
      name:
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Cliente',
      email: session.user.email || '',
      phone: session.user.user_metadata?.phone || '',
      avatarUrl:
        session.user.user_metadata?.avatar_url ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          session.user.email || 'Cliente'
        )}`,
      role: 'client'
    }
  };
}

export const supabaseAuthService: IAuthService = {
  getSession(): AuthSession {
    return {
      isAuthenticated: false,
      user: null
    };
  },

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (error) {
      throw new Error(error.message);
    }

    return mapSupabaseSession(data.session);
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }
};