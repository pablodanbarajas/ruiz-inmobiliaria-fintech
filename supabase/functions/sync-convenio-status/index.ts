import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const ADMIN_PANEL_ROLES = ['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja'] as const

type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]

const isAdminPanelRole = (value: unknown): value is AdminPanelRole =>
  typeof value === 'string' && ADMIN_PANEL_ROLES.includes(value as AdminPanelRole)

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

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError || !roleData || !isAdminPanelRole(roleData.role)) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: expired, error: expiredError } = await supabaseAdmin
      .from('convenios')
      .select('convenioid, ventaid, fecha_fin_estimada, comentarios')
      .eq('estatus', 'V')
      .not('fecha_fin_estimada', 'is', null)
      .lt('fecha_fin_estimada', today)

    if (expiredError) throw expiredError

    let updated = 0
    for (const convenio of expired || []) {
      const note = `Incumplimiento automático por vencimiento detectado el ${today}`
      const comentariosActuales = (convenio as any).comentarios?.trim()
      const comentarios = comentariosActuales ? `${comentariosActuales}\n${note}` : note

      const { error: updateError } = await supabaseAdmin
        .from('convenios')
        .update({ estatus: 'X', comentarios })
        .eq('convenioid', convenio.convenioid)
        .eq('estatus', 'V')

      if (updateError) throw updateError
      updated += 1
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sync-convenio-status error:', err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
