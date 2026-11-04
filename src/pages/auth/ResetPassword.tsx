import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

const passwordRules = [
  { label: 'Al menos 8 caracteres', test: (value: string) => value.length >= 8 },
  { label: 'Una letra mayúscula', test: (value: string) => /[A-ZÁÉÍÓÚÜÑ]/.test(value) },
  { label: 'Una letra minúscula', test: (value: string) => /[a-záéíóúüñ]/.test(value) },
  { label: 'Un número', test: (value: string) => /\d/.test(value) },
  { label: 'Un carácter especial', test: (value: string) => /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\d]/.test(value) },
]

export const ResetPassword = () => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const strong = passwordRules.every((rule) => rule.test(password))

  useEffect(() => {
    let mounted = true
    const checkAdminSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        if (mounted) setLoading(false)
        return
      }
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionData.session.user.id)
        .maybeSingle()
      if (mounted) {
        setReady(!!roleData)
        setLoading(false)
      }
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) void checkAdminSession()
    })
    void checkAdminSession()
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!strong) {
      setError('Completa todos los requisitos de seguridad.')
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      setSaved(true)
      window.setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Verificando enlace...</div>
  if (!ready) return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf8] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Enlace inválido o expirado</h1>
        <p className="mt-2 text-sm text-gray-500">Solicita un nuevo enlace de recuperación para tu cuenta administrativa.</p>
        <Link to="/forgot-password" className="mt-5 inline-block font-medium text-[#75602f] hover:underline">Solicitar otro enlace</Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-gray-900">Nueva contraseña</h1>
        <p className="mt-2 text-center text-sm text-gray-500">Crea una contraseña segura para tu cuenta administrativa.</p>
        {saved ? <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Contraseña actualizada. Redirigiendo al inicio de sesión...</p> : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c]" />
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {passwordRules.map((rule) => {
                const valid = rule.test(password)
                return <li key={rule.label} className={valid ? 'text-emerald-600' : 'text-gray-500'}>{valid ? '✓' : '○'} {rule.label}</li>
              })}
            </ul>
            <input type="password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirmar contraseña" autoComplete="new-password" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c]" />
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving || !strong || password !== confirmation} className="w-full rounded-lg bg-[#142127] py-3 font-semibold text-white hover:bg-[#24343b] disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
