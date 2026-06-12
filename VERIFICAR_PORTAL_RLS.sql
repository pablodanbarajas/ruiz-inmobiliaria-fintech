-- ============================================================================
-- VERIFICACIÓN PROFUNDA: Permisos RLS y Datos de Vistas
-- Ejecutar EN: https://supabase.com → Portal Project
-- ============================================================================

-- 1. Verificar permisos RLS en las vistas
SELECT 
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN 'ACTIVO' ELSE 'INACTIVO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('public_developments', 'client_lots', 'vista_pagos_cliente', 'desarrollo', 'cliente', 'lote', 'venta')
ORDER BY tablename;

-- 2. Intentar leer public_developments (sin autenticación)
SELECT 
  COUNT(*) as desarrollos_visibles,
  id,
  name,
  description,
  min_apartado
FROM public.public_developments
LIMIT 5;

-- 3. Verificar si las vistas tienen security_invoker
SELECT 
  schemaname,
  viewname,
  pg_get_viewdef(format('%I.%I', schemaname, viewname)::regclass) as vista_definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('public_developments', 'client_lots', 'vista_pagos_cliente');

-- 4. Contar cuántos desarrollos activos hay
SELECT 
  COUNT(*) as desarrollos_activos,
  estatus
FROM public.desarrollo
GROUP BY estatus;

-- 5. Verificar trigger de vinculación user_id
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name ILIKE '%link%'
ORDER BY trigger_name;

-- 6. Mostrar un desarrollo y sus lotes disponibles
SELECT 
  d.desarrolloid,
  d.nombre,
  d.estatus,
  d.montominimoapartado,
  (SELECT COUNT(*) FROM lote WHERE desarrolloid = d.desarrolloid AND estatus = 'D') as lotes_disponibles
FROM public.desarrollo d
WHERE d.estatus = 'A'
LIMIT 3;

-- 7. Verificar estructura de la vista public_developments
\d public.public_developments
