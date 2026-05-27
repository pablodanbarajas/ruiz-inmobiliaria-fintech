import { useEffect, useState, useCallback } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Mail, CheckCircle, Clock, XCircle, RefreshCw, Users } from 'lucide-react'

type InviteCandidate = {
  clienteid: number
  nombre: string | null
  email: string
  telefonocelular: string | null
  user_id: string | null
  development_id: number
  development_name: string
  num_lotes: number
}

type InviteStatus = 'idle' | 'loading' | 'success' | 'error'
type StatusMap = Record<number, { status: InviteStatus; message?: string }>

const DESARROLLO_ID = 20

export const InvitarClientes = () => {
  const [candidates, setCandidates] = useState<InviteCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMap, setStatusMap] = useState<StatusMap>({})

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('portal_invite_candidates')
        .select('*')
        .eq('development_id', DESARROLLO_ID)
        .order('nombre', { ascending: true })

      if (error) throw error
      setCandidates((data ?? []) as InviteCandidate[])
    } catch (err) {
      console.error('Error cargando candidatos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const handleInvite = async (cliente: InviteCandidate) => {
    setStatusMap(prev => ({ ...prev, [cliente.clienteid]: { status: 'loading' } }))
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sesión no encontrada')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-client`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: cliente.email }),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Error al invitar')

      setStatusMap(prev => ({
        ...prev,
        [cliente.clienteid]: { status: 'success', message: 'Invitación enviada' },
      }))
      // Recargar lista después de un momento para reflejar cambios
      setTimeout(fetchCandidates, 2000)
    } catch (err: any) {
      setStatusMap(prev => ({
        ...prev,
        [cliente.clienteid]: {
          status: 'error',
          message: err.message ?? 'Error desconocido',
        },
      }))
    }
  }

  const activeCount  = candidates.filter(c =>  c.user_id).length
  const pendingCount = candidates.filter(c => !c.user_id).length

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Portal Clientes — Invitaciones
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Desarrollo de Prueba &middot;{' '}
            {candidates.length} cliente{candidates.length !== 1 ? 's' : ''} con lotes activos
          </p>
        </div>

        {/* Contadores */}
        <div className="flex flex-wrap gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            {activeCount} con acceso activo
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            <Clock className="w-4 h-4" />
            {pendingCount} sin invitar
          </span>
          <button
            onClick={fetchCandidates}
            className="ml-auto inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando clientes...</div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No hay clientes con lotes en este desarrollo.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Teléfono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Lotes</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => {
                  const st = statusMap[c.clienteid]
                  const isBusy = st?.status === 'loading'
                  const isDone = st?.status === 'success'

                  return (
                    <tr key={c.clienteid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.email}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {c.telefonocelular ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {c.num_lotes}
                      </td>
                      <td className="px-4 py-3">
                        {c.user_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> Activo
                          </span>
                        ) : isDone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                            <Mail className="w-3 h-3" /> Enviada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                            <Clock className="w-3 h-3" /> Sin acceso
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!c.user_id && (
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy || isDone}
                              onClick={() => handleInvite(c)}
                              className="gap-1.5"
                            >
                              {isBusy ? (
                                'Enviando...'
                              ) : st?.status === 'error' ? (
                                <>
                                  <XCircle className="w-3 h-3 text-red-500" />
                                  Reintentar
                                </>
                              ) : (
                                <>
                                  <Mail className="w-3 h-3" />
                                  Invitar
                                </>
                              )}
                            </Button>
                            {st?.status === 'error' && (
                              <p className="text-xs text-red-500 max-w-[150px] text-right">
                                {st.message}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
