import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export const Login = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      navigate('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
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
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center px-8 overflow-hidden">
        <div className="w-full max-w-2xl">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-5xl font-bold text-black mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Ruiz</h1>
            <h2 className="text-3xl font-bold text-[#eaae4c]" style={{ fontFamily: 'Playfair Display, serif' }}>Inmobiliaria</h2>
          </div>

          <div className="mb-8 text-center md:text-left">
            <h1 className="text-5xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Bienvenido</h1>
            <p className="text-gray-600 text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>Inicia sesión en tu cuenta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={loading}
                className="w-full px-5 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eaae4c] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full px-5 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eaae4c] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-lg text-base font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-3 text-lg rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
