import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@/types/database'

export const useAuth = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            nombre: session.user.user_metadata?.nombre || '',
            apellido: session.user.user_metadata?.apellido || '',
          })
        }
      } catch (err) {
        console.error('Session check error:', err)
        setError(err instanceof Error ? err.message : 'Session error')
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          nombre: session.user.user_metadata?.nombre || '',
          apellido: session.user.user_metadata?.apellido || '',
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email,
          nombre: data.session.user.user_metadata?.nombre || '',
          apellido: data.session.user.user_metadata?.apellido || '',
        })
        navigate('/admin/dashboard')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError(errorMessage)
      throw err
    }
  }

  const logout = async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      navigate('/login')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed'
      setError(errorMessage)
      throw err
    }
  }

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  }
}
