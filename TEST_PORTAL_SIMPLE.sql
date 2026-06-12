-- ============================================================================
-- TEST SIMPLE: Leer directamente public_developments
-- Ejecutar EN: SQL Editor del Portal Supabase
-- ============================================================================

-- 1. Contar desarrollos en la vista (sin GROUP BY)
SELECT COUNT(*) as total_desarrollos
FROM public.public_developments;

-- 2. Listar todos los desarrollos completos
SELECT 
  id,
  name,
  description,
  location,
  available_lots,
  min_apartado,
  enganche
FROM public.public_developments;

-- 3. Verificar permisos en la vista
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name='public_developments'
  AND table_schema='public';

-- 4. Verificar si public_developments usa security_invoker
SELECT schemaname, viewname, pg_get_viewdef(oid)
FROM pg_views
WHERE viewname = 'public_developments'
  AND schemaname = 'public';
