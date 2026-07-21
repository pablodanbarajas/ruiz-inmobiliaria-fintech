import { supabase } from './client';
import type { IAuthService } from '../interfaces';
import type { AuthSession, LoginCredentials, RegisterCredentials } from '../../types/auth.types';

interface ClientRecord {
  clienteid: number;
  nombre: string;
  email: string;
  telefonocelular: string;
}

async function mapSupabaseSessionWithClientData(session: any): Promise<AuthSession> {
  if (!session?.user) {
    return {
      isAuthenticated: false,
      user: null
    };
  }

  // Obtener datos del cliente desde la tabla cliente
  let clientData: ClientRecord | null = null;
  try {
    const { data } = await supabase
      .from('cliente')
      .select('clienteid, nombre, email, telefonocelular')
      .eq('email', session.user.email)
      .maybeSingle();
    
    clientData = data as ClientRecord | null;
  } catch (error) {
    console.warn('Error fetching client data:', error);
  }

  return {
    isAuthenticated: true,
    user: {
      id: clientData?.clienteid?.toString() || session.user.id,
      name:
        clientData?.nombre?.trim().split(/\s+/)[0] ||
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Cliente',
      email: session.user.email || '',
      phone: clientData?.telefonocelular || session.user.user_metadata?.phone || '',
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

    return mapSupabaseSessionWithClientData(data.session);
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },

  async register(credentials: RegisterCredentials): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          full_name: credentials.name,
          phone: credentials.phone
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    // Si Supabase requiere confirmación de email, data.session será null
    if (!data.session) {
      throw new Error('Confirma tu correo electrónico para activar tu cuenta.');
    }

    return mapSupabaseSessionWithClientData(data.session);
  }
};