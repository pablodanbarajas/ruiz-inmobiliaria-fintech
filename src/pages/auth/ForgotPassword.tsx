import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      )
      if (resetError) throw resetError
      setMessage('Si existe una cuenta administrativa con ese correo, recibirás un enlace para restablecer la contraseña.')
      setEmail('')
    } catch {
      setError('No se pudo enviar el enlace. Verifica el correo e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="mt-2 text-sm text-gray-500">Te enviaremos un enlace al correo de tu cuenta administrativa.</p>
        </div>
        {message && <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Correo electrónico</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#142127] py-3 font-semibold text-white transition-colors hover:bg-[#24343b] disabled:opacity-50">
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-[#75602f] hover:underline">Volver a iniciar sesión</Link>
        </div>
      </div>
    </div>
  )
}
