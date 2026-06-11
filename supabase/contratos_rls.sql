-- ============================================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLAS DE CONTRATOS
-- ============================================================================
-- Este archivo define las políticas RLS para contratos
-- Debe ejecutarse como administrador de Supabase
-- ============================================================================

-- ============================================================================
-- 1. HABILITAR RLS EN TABLAS DE CONTRATOS
-- ============================================================================

ALTER TABLE public.contrato_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_generado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variables_disponibles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. POLÍTICAS PARA TABLA: contrato_template
-- ============================================================================

-- Admin puede leer y crear templates
DROP POLICY IF EXISTS "contrato_template_select_admin" ON public.contrato_template;
CREATE POLICY "contrato_template_select_admin" ON public.contrato_template
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

DROP POLICY IF EXISTS "contrato_template_insert_admin" ON public.contrato_template;
CREATE POLICY "contrato_template_insert_admin" ON public.contrato_template
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

DROP POLICY IF EXISTS "contrato_template_update_admin" ON public.contrato_template;
CREATE POLICY "contrato_template_update_admin" ON public.contrato_template
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

DROP POLICY IF EXISTS "contrato_template_delete_admin" ON public.contrato_template;
CREATE POLICY "contrato_template_delete_admin" ON public.contrato_template
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 3. POLÍTICAS PARA TABLA: contrato_generado
-- ============================================================================

-- Admin puede leer contratos generados
DROP POLICY IF EXISTS "contrato_generado_select_admin" ON public.contrato_generado;
CREATE POLICY "contrato_generado_select_admin" ON public.contrato_generado
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Admin puede generar contratos
DROP POLICY IF EXISTS "contrato_generado_insert_admin" ON public.contrato_generado;
CREATE POLICY "contrato_generado_insert_admin" ON public.contrato_generado
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Admin puede actualizar contratos (cambiar estado)
DROP POLICY IF EXISTS "contrato_generado_update_admin" ON public.contrato_generado;
CREATE POLICY "contrato_generado_update_admin" ON public.contrato_generado
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 4. POLÍTICAS PARA TABLA: variables_disponibles
-- ============================================================================

-- Todos los usuarios autenticados pueden leer variables disponibles
DROP POLICY IF EXISTS "variables_disponibles_select_all" ON public.variables_disponibles;
CREATE POLICY "variables_disponibles_select_all" ON public.variables_disponibles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

-- Estos índices ya pueden estar creados pero los incluimos por seguridad
CREATE INDEX IF NOT EXISTS idx_contrato_template_desarrolloid ON public.contrato_template(desarrolloid);
CREATE INDEX IF NOT EXISTS idx_contrato_template_es_activa ON public.contrato_template(es_activa);
CREATE INDEX IF NOT EXISTS idx_contrato_template_tipo ON public.contrato_template(tipo_contrato);

CREATE INDEX IF NOT EXISTS idx_contrato_generado_ventaid ON public.contrato_generado(ventaid);
CREATE INDEX IF NOT EXISTS idx_contrato_generado_template_id ON public.contrato_generado(contrato_template_id);
CREATE INDEX IF NOT EXISTS idx_contrato_generado_estado ON public.contrato_generado(estado);

-- ============================================================================
-- VERIFICACIÓN - Ejecutar después de aplicar políticas
-- ============================================================================

-- Verificar que RLS está habilitado
/*
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('contrato_template', 'contrato_generado', 'variables_disponibles')
AND schemaname = 'public';

-- Verificar políticas creadas
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('contrato_template', 'contrato_generado', 'variables_disponibles')
AND schemaname = 'public'
ORDER BY tablename;
*/
