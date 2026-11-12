import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode
} from 'react';
import type { AuthSession, LoginCredentials, RegisterCredentials } from '../types/auth.types';
import { authService } from '../services';
import { supabase } from '../services/supabase/client';
import { repairClientLink } from '../services/supabase/auth.service';
import { formatPersonName } from '../utils/text';

interface AuthContextValue {
  session: AuthSession;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
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
    await repairClientLink();
    const { data } = await supabase
      .from('cliente')
      .select('clienteid, nombre')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (data) {
      const firstName = formatPersonName((data as ClientRecord).nombre.trim().split(/\s+/)[0]);
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
      // No third-party avatar service: it received the client's email. The
      // header shows the name's initial when there's no photo.
      avatarUrl: session.user.user_metadata?.avatar_url || null,
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

  // Supabase auth user already reflected in `session` (see the listener below).
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    // Inicializar sesión
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      currentUserId.current = data.session?.user?.id ?? null;
      const baseSession = mapSupabaseSession(data.session);
      const enriched = await enrichWithClientData(baseSession);
      if (!isMounted) return;
      setSession(enriched);
      setIsLoading(false);
    });

    // Listener de cambios de sesión (con delay para evitar race conditions)
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Supabase re-announces the same sign-in when the tab regains focus and
        // when it refreshes the token. Rebuilding the session then re-rendered
        // the whole portal for nothing, so only a real change goes through.
        if (
          (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
          session?.user?.id && session.user.id === currentUserId.current
        ) {
          return;
        }

        currentUserId.current = session?.user?.id ?? null;

        // Cancelar timeout anterior si existe
        if (timeoutId) clearTimeout(timeoutId);
        
        // Esperar a que otros procesos terminen
        timeoutId = setTimeout(async () => {
          if (!isMounted) return;
          
          try {
            const baseSession = mapSupabaseSession(session);
            const enriched = await enrichWithClientData(baseSession);
            if (!isMounted) return;
            setSession(enriched);
          } catch (error) {
            console.warn('Error en auth state change:', error);
          }
        }, 200);
      }
    );

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
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

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const newSession = await authService.register(credentials);
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
    <AuthContext.Provider value={{ session, isLoading, login, register, logout }}>
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