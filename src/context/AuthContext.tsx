import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type UserRole = 'admin' | 'vendedor'

interface AuthUser {
  id: string
  email: string | undefined
  nombre: string
  apellido: string
}

interface AuthContextValue {
  user: AuthUser | null
  role: UserRole | null
  loading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const fetchRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    return (data?.role as UserRole) ?? null
  } catch {
    return null
  }
}

const buildUser = (supabaseUser: any): AuthUser => ({
  id: supabaseUser.id,
  email: supabaseUser.email,
  nombre: supabaseUser.user_metadata?.nombre || '',
  apellido: supabaseUser.user_metadata?.apellido || '',
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // getSession reads localStorage — no network, resolves in <1ms
    // We resolve loading immediately so ProtectedRoute never blocks
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(buildUser(session.user))
        // Fetch role in background — role arriving slightly later is fine
        fetchRole(session.user.id).then((r) => {
          if (mounted) setRole(r)
        })
      }
      // Unblock ProtectedRoute immediately — no network wait
      setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setRole(null)
          return
        }
        if (session?.user) {
          setUser(buildUser(session.user))
          fetchRole(session.user.id).then((r) => {
            if (mounted) setRole(r)
          })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    // onAuthStateChange will fire SIGNED_OUT and clear user/role,
    // but clear immediately so UI reacts without delay
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, role, loading, isAuthenticated: !!user, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
