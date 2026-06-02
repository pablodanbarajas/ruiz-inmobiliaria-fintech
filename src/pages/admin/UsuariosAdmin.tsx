import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  ASSIGNABLE_ADMIN_ROLES,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_LABELS,
  type AdminPanelRole,
} from '@/config/roles'
import { supabase } from '@/lib/supabaseClient'
import { RefreshCw, Save, ShieldCheck, Users } from 'lucide-react'

type AdminUserRecord = {
  user_id: string
  email: string | null
  role: AdminPanelRole | null
  created_at?: string | null
  last_sign_in_at?: string | null
}

type SaveState = 'idle' | 'saving' | 'ok' | 'error'

type SaveMap = Record<string, { state: SaveState; message?: string }>

export const UsuariosAdmin = () => {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [draftRoles, setDraftRoles] = useState<Record<string, AdminPanelRole | ''>>({})
  const [saveMap, setSaveMap] = useState<SaveMap>({})

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sesion no encontrada')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admin-users`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Error cargando usuarios')

      const list = (result.users ?? []) as AdminUserRecord[]
      setUsers(list)

      const initialDrafts: Record<string, AdminPanelRole | ''> = {}
      for (const u of list) initialDrafts[u.user_id] = u.role ?? ''
      setDraftRoles(initialDrafts)
    } catch (err) {
      console.error('Error loading admin users:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const term = filter.trim().toLowerCase()
    if (!term) return users
    return users.filter((u) => {
      const roleLabel = u.role ? ROLE_LABELS[u.role].toLowerCase() : ''
      return (
        u.user_id.toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        roleLabel.includes(term)
      )
    })
  }, [users, filter])

  const handleSaveRole = async (userId: string) => {
    const role = draftRoles[userId]
    if (!role) {
      setSaveMap((prev) => ({
        ...prev,
        [userId]: { state: 'error', message: 'Selecciona un rol valido' },
      }))
      return
    }

    setSaveMap((prev) => ({ ...prev, [userId]: { state: 'saving' } }))

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sesion no encontrada')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admin-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId, role }),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudo actualizar el rol')

      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role } : u)))
      setSaveMap((prev) => ({ ...prev, [userId]: { state: 'ok', message: 'Rol actualizado' } }))
    } catch (err: any) {
      setSaveMap((prev) => ({
        ...prev,
        [userId]: { state: 'error', message: err.message ?? 'Error actualizando rol' },
      }))
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Administracion de Usuarios
            </h1>
            <p className="text-[#9e9f92] mt-2">
              Asignacion de roles para usuarios de administracion (no clientes del portal)
            </p>
          </div>
          <Button onClick={fetchUsers} variant="outline" className="inline-flex items-center gap-2">
            <RefreshCw size={16} />
            Recargar
          </Button>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6">
          <label className="block text-sm font-medium text-black mb-1">Buscar por email, role o user_id</label>
          <Input
            placeholder="usuario@empresa.com"
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users size={18} className="text-[#eaae4c]" />
            <h2 className="font-semibold text-gray-800">Usuarios de administracion</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">Cargando usuarios...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-500">No se encontraron usuarios</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Email</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">User ID</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Rol actual</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Nuevo rol</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => {
                    const saveState = saveMap[u.user_id]
                    const selectedRole = draftRoles[u.user_id] ?? ''

                    return (
                      <tr key={u.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{u.email || '—'}</td>
                        <td className="px-6 py-4 text-xs text-gray-500 max-w-[320px] truncate" title={u.user_id}>
                          {u.user_id}
                        </td>
                        <td className="px-6 py-4">
                          {u.role ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-[#eaae4c]/20 text-[#504840]">
                              <ShieldCheck size={12} />
                              {ROLE_LABELS[u.role]}
                            </span>
                          ) : (
                            <span className="text-gray-400">Sin rol</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            className="w-full max-w-[220px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                            value={selectedRole}
                            onChange={(e) =>
                              setDraftRoles((prev) => ({
                                ...prev,
                                [u.user_id]: e.target.value as AdminPanelRole,
                              }))
                            }
                          >
                            <option value="">Selecciona rol...</option>
                            {ASSIGNABLE_ADMIN_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="inline-flex items-center gap-1.5"
                              disabled={saveState?.state === 'saving' || !selectedRole}
                              onClick={() => handleSaveRole(u.user_id)}
                            >
                              <Save size={14} />
                              {saveState?.state === 'saving' ? 'Guardando...' : 'Guardar'}
                            </Button>
                            {saveState?.message && (
                              <p className={`text-xs ${saveState.state === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                {saveState.message}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Matriz de capacidades por rol</h2>
            <p className="text-xs text-gray-500 mt-1">Basada en la tabla de capacidades proporcionada</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 min-w-[280px]">Funcion / Accion</th>
                  {ASSIGNABLE_ADMIN_ROLES.map((role) => (
                    <th key={role} className="text-center px-4 py-3 font-semibold text-gray-600 min-w-[120px]">
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.keys(CAPABILITY_LABELS).map((capability) => (
                  <tr key={capability} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{CAPABILITY_LABELS[capability as keyof typeof CAPABILITY_LABELS]}</td>
                    {ASSIGNABLE_ADMIN_ROLES.map((role) => (
                      <td key={`${capability}-${role}`} className="px-4 py-3 text-center">
                        {ROLE_CAPABILITIES[role][capability as keyof (typeof ROLE_CAPABILITIES)[typeof role]] ? (
                          <span className="text-green-700 font-semibold">VERDADERO</span>
                        ) : (
                          <span className="text-gray-400">FALSO</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
