import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export const Login = () => {
  const navigate = useNavigate()
  const { isAuthenticated, role, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Only handles the case where user is already authenticated when visiting /login (e.g. page refresh)
  useEffect(() => {
    if (!authLoading && isAuthenticated && (role === 'admin' || role === 'vendedor')) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [authLoading, isAuthenticated, role, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      // Check role directly after sign in — no race condition
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Error al obtener sesión. Intenta de nuevo.')
        setLoading(false)
        return
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      const userRole = roleData?.role as string | null
      if (userRole === 'admin' || userRole === 'vendedor') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        await supabase.auth.signOut()
        setError('No tienes permisos para acceder al panel de administración.')
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Hero Section - Left Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden flex-col justify-center items-center p-8">
        {/* Background gradient elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-[#eaae4c] to-transparent opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-[#504840] to-transparent opacity-5 rounded-full translate-x-1/2 translate-y-1/2"></div>

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center h-full w-full">
          <img 
            src="/images/ruiz-inmobiliaria-imagen-03.jpg" 
            alt="Ruiz Inmobiliaria" 
            className="max-h-screen max-w-full object-contain drop-shadow-2xl"
          />
        </div>
      </div>

      {/* Login Section - Right Side */}
      <div className="w-full lg:w-1/2 bg-[#fafaf8] flex flex-col items-center justify-center px-12 overflow-hidden relative">
        {/* Subtle top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#504840] via-[#eaae4c] to-[#504840]" />

        <div className="w-full max-w-xl">
          {/* Logo mark visible on desktop */}
          <div className="hidden lg:flex flex-col items-center mb-12">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>Ruiz</span>
              <span className="text-5xl font-bold text-[#eaae4c]" style={{ fontFamily: 'Playfair Display, serif' }}>Inmobiliaria</span>
            </div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#9e9f92] font-medium">Sistema de Administración</p>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-5xl font-bold text-black mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Ruiz</h1>
            <h2 className="text-3xl font-bold text-[#eaae4c]" style={{ fontFamily: 'Playfair Display, serif' }}>Inmobiliaria</h2>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-12 py-12">
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Bienvenido</h1>
              <div className="flex items-center gap-3 mt-3 mb-3">
                <div className="h-0.5 w-10 bg-[#eaae4c] rounded-full" />
                <p className="text-base text-gray-500">Ingresa tus credenciales para continuar</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eaae4c] focus:border-transparent bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-11 py-3.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eaae4c] focus:border-transparent bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-4 text-base rounded-lg transition-colors mt-2"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} Ruiz Inmobiliaria · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
