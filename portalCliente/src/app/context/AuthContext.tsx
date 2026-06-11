import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode
} from 'react';
import type { AuthSession, LoginCredentials } from '../types/auth.types';
import { authService } from '../services';
import { supabase } from '../services/supabase/client';

interface AuthContextValue {
  session: AuthSession;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

interface ClientRecord {
  clienteid: number;
  nombre: string;
}

async function enrichWithClientData(session: AuthSession): Promise<AuthSession> {
  if (!session.isAuthenticated || !session.user?.email) return session;
  
  try {
    const { data } = await supabase
      .from('cliente')
      .select('clienteid, nombre')
      .eq('email', session.user.email)
      .maybeSingle();
    
    if (data) {
      const firstName = (data as ClientRecord).nombre.trim().split(/\s+/)[0];
      return {
        ...session,
        user: {
          ...session.user,
          name: firstName,
          id: (data as ClientRecord).clienteid.toString() // Usar clienteid como id
        }
      };
    }
  } catch (error) {
    console.warn('Error enriching client data:', error);
  }
  
  return session;
}

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

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession>({
    isAuthenticated: false,
    user: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      const baseSession = mapSupabaseSession(data.session);
      const enriched = await enrichWithClientData(baseSession);
      if (!isMounted) return;
      setSession(enriched);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const baseSession = mapSupabaseSession(session);
        const enriched = await enrichWithClientData(baseSession);
        setSession(enriched);
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const newSession = await authService.login(credentials);
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setSession({ isAuthenticated: false, user: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}