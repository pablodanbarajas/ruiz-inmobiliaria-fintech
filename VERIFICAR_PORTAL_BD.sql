-- ============================================================================
-- SCRIPT DE VERIFICACIÓN: BD del Portal Supabase
-- Ejecutar EN: https://supabase.com → Portal Project (ivbyroqxyfclzfhaixjd)
-- ============================================================================

-- 1. Verificar tablas principales
SELECT 
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('cliente', 'desarrollo', 'lote', 'venta', 'corridafinanciera', 'pagos')
ORDER BY table_name;

-- 2. Verificar vistas
SELECT viewname, schemaname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('public_developments', 'client_lots', 'vista_pagos_cliente')
ORDER BY viewname;

-- 3. Contar registros en cada tabla (si existen)
SELECT 
  'cliente' as tabla,
  COUNT(*) as registros
FROM public.cliente
UNION ALL
SELECT 'desarrollo', COUNT(*) FROM public.desarrollo
UNION ALL
SELECT 'lote', COUNT(*) FROM public.lote
UNION ALL
SELECT 'venta', COUNT(*) FROM public.venta
UNION ALL
SELECT 'corridafinanciera', COUNT(*) FROM public.corridafinanciera
UNION ALL
SELECT 'pagos', COUNT(*) FROM public.pagos
ORDER BY tabla;

-- 4. Estructura de auth.users
SELECT 
  COUNT(*) as usuarios_portal,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmados
FROM auth.users;

-- 5. Verificar si cliente tiene user_id
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cliente'
  AND table_schema = 'public'
  AND column_name = 'user_id';
