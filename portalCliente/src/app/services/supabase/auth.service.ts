import { supabase } from './client';
import type { IAuthService } from '../interfaces';
import type { AuthSession, LoginCredentials, RegisterCredentials } from '../../types/auth.types';
import { formatPersonName } from '../../utils/text';

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
      .eq('user_id', session.user.id)
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
        formatPersonName(clientData?.nombre?.trim().split(/\s+/)[0]) ||
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Cliente',
      email: session.user.email || '',
      phone: clientData?.telefonocelular || session.user.user_metadata?.phone || '',
      // No third-party avatar service: it received the client's email. The
      // header shows the name's initial when there's no photo.
      avatarUrl: session.user.user_metadata?.avatar_url || null,
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

    await repairClientLink();
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
        emailRedirectTo: `${window.location.origin}/portal/login`,
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

    await repairClientLink();
    return mapSupabaseSessionWithClientData(data.session);
  }
};

export async function repairClientLink(): Promise<void> {
  const { error } = await supabase.rpc('repair_my_cliente_link');
  if (error) {
    console.warn('No se pudo reparar el vínculo del cliente:', error.message);
  }
}