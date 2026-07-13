-- ============================================================================
-- SEGURIDAD: CORRECCIONES PENDIENTES
-- Ejecutar en Supabase SQL Editor en orden
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS (necesarias para las políticas)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
$$;

CREATE OR REPLACE FUNCTION public.has_admin_panel_role(roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY(roles)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = ANY(roles)
    )
$$;

-- ============================================================================
-- 2. HABILITAR RLS EN TABLAS QUE PUEDEN FALTARLE
-- ============================================================================

ALTER TABLE public.cargos_extra   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote           ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. POLÍTICAS PARA cargos_extra
-- ============================================================================

DROP POLICY IF EXISTS "cargos_extra_select" ON public.cargos_extra;
CREATE POLICY "cargos_extra_select" ON public.cargos_extra
  FOR SELECT
  USING (public.is_admin_role());

DROP POLICY IF EXISTS "cargos_extra_insert" ON public.cargos_extra;
CREATE POLICY "cargos_extra_insert" ON public.cargos_extra
  FOR INSERT
  WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS "cargos_extra_update" ON public.cargos_extra;
CREATE POLICY "cargos_extra_update" ON public.cargos_extra
  FOR UPDATE
  USING (public.is_admin_role());

DROP POLICY IF EXISTS "cargos_extra_delete" ON public.cargos_extra;
CREATE POLICY "cargos_extra_delete" ON public.cargos_extra
  FOR DELETE
  USING (public.is_admin_role());

-- ============================================================================
-- 4. POLÍTICAS PARA user_roles (solo admin puede leer/modificar)
-- ============================================================================

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT
  USING (
    user_id = auth.uid()  -- usuario ve su propio rol
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================================
-- 5. CORREGIR contrato_template y contrato_generado
--    (ya ejecutado antes, pero incluido aquí para consistencia)
-- ============================================================================

DROP POLICY IF EXISTS contrato_template_admin ON public.contrato_template;
CREATE POLICY contrato_template_admin ON public.contrato_template
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS contrato_generado_admin ON public.contrato_generado;
CREATE POLICY contrato_generado_admin ON public.contrato_generado
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

-- ============================================================================
-- 6. ÍNDICE ADICIONAL para performance de RLS en user_roles
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
