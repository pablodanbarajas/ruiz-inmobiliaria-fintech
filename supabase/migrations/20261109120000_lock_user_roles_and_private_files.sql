-- Phase 1 of the access fix.
--
-- Any signed-in user, including portal clients who can register on their own,
-- could insert themselves into user_roles as admin and read or delete every
-- private file. This keeps role changes on the service-role path
-- (manage-admin-users), lets each user read only their own role, and limits
-- private files to admin panel staff.

-- ── user_roles ────────────────────────────────────────────────────────────
-- Writes now require the service role. The app only reads this table from the
-- browser; manage-admin-users creates and changes roles with the service key.
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;

-- Panel staff read every role (Clientes and Ventas Externas need it).
-- has_admin_panel_role is SECURITY DEFINER, so it reads user_roles without
-- going through this policy again.
CREATE POLICY user_roles_select_own_or_panel ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_admin_panel_role(ARRAY[
      'admin', 'finanzas', 'vendedor', 'vendedor_externo',
      'contratos', 'cobranza_caja', 'desarrollo_ri'
    ])
  );

-- ── Private files ─────────────────────────────────────────────────────────
-- Only the admin panel uploads, reads and deletes these files; the client
-- portal doesn't use Storage.
DROP POLICY IF EXISTS "Authenticated select documentos-clientes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert documentos-clientes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documentos-clientes" ON storage.objects;
DROP POLICY IF EXISTS contratos_firmados_select ON storage.objects;
DROP POLICY IF EXISTS contratos_firmados_insert ON storage.objects;
DROP POLICY IF EXISTS contratos_firmados_delete ON storage.objects;

CREATE POLICY private_files_select_panel ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('documentos-clientes', 'contratos-firmados')
    AND public.has_admin_panel_role(ARRAY[
      'admin', 'finanzas', 'vendedor', 'vendedor_externo',
      'contratos', 'cobranza_caja', 'desarrollo_ri'
    ])
  );

CREATE POLICY private_files_insert_panel ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('documentos-clientes', 'contratos-firmados')
    AND public.has_admin_panel_role(ARRAY[
      'admin', 'finanzas', 'vendedor', 'vendedor_externo',
      'contratos', 'cobranza_caja', 'desarrollo_ri'
    ])
  );

CREATE POLICY private_files_delete_panel ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('documentos-clientes', 'contratos-firmados')
    AND public.has_admin_panel_role(ARRAY[
      'admin', 'finanzas', 'vendedor', 'vendedor_externo',
      'contratos', 'cobranza_caja', 'desarrollo_ri'
    ])
  );
