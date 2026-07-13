import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const ASSIGNABLE_ADMIN_ROLES = [
  'admin',
  'finanzas',
  'vendedor',
  'contratos',
  'cobranza_caja',
] as const

type AssignableAdminRole = (typeof ASSIGNABLE_ADMIN_ROLES)[number]

const isAssignableRole = (value: unknown): value is AssignableAdminRole =>
  typeof value === 'string' && ASSIGNABLE_ADMIN_ROLES.includes(value as AssignableAdminRole)

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (!['GET', 'POST'].includes(req.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerRoleData, error: callerRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (callerRoleError || !callerRoleData || callerRoleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden gestionar usuarios' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'GET') {
      const allUsers: Array<{
        id: string
        email: string | null
        created_at?: string | null
        last_sign_in_at?: string | null
      }> = []

      let page = 1
      const perPage = 200
      let keepGoing = true

      while (keepGoing) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error) throw error

        const batch = data.users ?? []
        for (const u of batch) {
          allUsers.push({
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
          })
        }

        keepGoing = batch.length === perPage
        page += 1
      }

      const userIds = allUsers.map((u) => u.id)

      const { data: roleRows, error: roleRowsError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

      if (roleRowsError) throw roleRowsError

      const roleMap = new Map<string, string>()
      for (const r of roleRows || []) roleMap.set(r.user_id, r.role)

      // Excluir cuentas del portal cliente
      const { data: clientRows, error: clientRowsError } = await supabaseAdmin
        .from('cliente')
        .select('user_id')
        .not('user_id', 'is', null)

      if (clientRowsError) throw clientRowsError

      const clientUserIds = new Set((clientRows || []).map((c: any) => c.user_id))

      const users = allUsers
        .filter((u) => !clientUserIds.has(u.id))
        .map((u) => {
          const rawRole = roleMap.get(u.id)
          const role = isAssignableRole(rawRole) ? rawRole : null
          return {
            user_id: u.id,
            email: u.email,
            role,
            created_at: u.created_at ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
          }
        })
        .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))

      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    const action = body?.action  // 'create' | undefined (update)

    // ── CREATE: invite new admin user ────────────────────────────
    if (action === 'create') {
      const email = body?.email?.trim()
      const role = body?.role

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: 'Email inválido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!isAssignableRole(role)) {
        return new Response(JSON.stringify({ error: 'Rol inválido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Invite user — creates auth account and sends email
      const adminPanelUrl = Deno.env.get('ADMIN_PANEL_URL') ?? 'https://ruiz-inmobiliaria-fintech.vercel.app/login'
      const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: adminPanelUrl,
      })
      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Assign role immediately
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: invited.user.id, role }, { onConflict: 'user_id' })
      if (roleError) throw roleError

      return new Response(JSON.stringify({ ok: true, userId: invited.user.id, email, role }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── UPDATE: change role for existing user ────────────────────
    const userId = body?.userId
    const role = body?.role

    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'userId es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isAssignableRole(role)) {
      return new Response(JSON.stringify({ error: 'Rol invalido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: upsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role }, { onConflict: 'user_id' })

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ ok: true, userId, role }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('manage-admin-users error:', err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
