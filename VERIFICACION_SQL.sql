-- ============================================================================
-- SCRIPT DE VERIFICACIÓN: Validar que todos los SQL fueron ejecutados correctamente
-- ============================================================================
-- Ejecuta este script en Supabase Console → SQL Editor
-- Te mostrará si todo está configurado correctamente
-- ============================================================================

-- 1. VERIFICAR VIEWS CREADAS
SELECT 'VIEWS CREADAS' as "VERIFICACIÓN";
SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public' 
AND viewname IN ('public_developments', 'client_lots', 'vista_pagos_cliente');
-- Resultado esperado: 3 filas (las 3 views)

---

-- 2. VERIFICAR FUNCIONES CREADAS
SELECT 'FUNCIONES CREADAS' as "VERIFICACIÓN";
SELECT proname, pronargs FROM pg_proc WHERE proname IN (
  'calcular_recargo', 'generar_contrato_html', 'check_max_convenios_per_year'
) AND prokind = 'f';
-- Resultado esperado: 3 filas (las 3 funciones)

---

-- 3. VERIFICAR TABLAS DE CONTRATOS
SELECT 'TABLAS DE CONTRATOS' as "VERIFICACIÓN";
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
AND tablename IN ('contrato_template', 'contrato_generado', 'variables_disponibles');
-- Resultado esperado: 3 filas (las 3 tablas)

---

-- 4. VERIFICAR REGISTROS EN VARIABLES_DISPONIBLES
SELECT 'VARIABLES DISPONIBLES (Cantidad)' as "VERIFICACIÓN";
SELECT COUNT(*) as "Total de variables" FROM variables_disponibles;
-- Resultado esperado: 25+ filas

---

-- 5. VERIFICAR RLS HABILITADO EN TABLAS
SELECT 'RLS HABILITADO' as "VERIFICACIÓN";
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
AND tablename IN ('cliente', 'venta', 'corridafinanciera', 'pagos', 'convenios')
AND rowsecurity = true;
-- Resultado esperado: 5+ filas (todas con RLS = true)

---

-- 6. VERIFICAR POLÍTICAS RLS
SELECT 'POLÍTICAS RLS' as "VERIFICACIÓN";
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
LIMIT 15;
-- Resultado esperado: Varias filas con políticas

---

-- 7. VERIFICAR TRIGGER DE CONVENIOS
SELECT 'TRIGGER LÍMITE 3 CONVENIOS' as "VERIFICACIÓN";
SELECT tgname FROM pg_trigger WHERE tgname = 'tg_max_convenios_per_year';
-- Resultado esperado: 1 fila (el trigger)

---

-- 8. VERIFICAR ÍNDICES CREADOS
SELECT 'ÍNDICES CREADOS' as "VERIFICACIÓN";
SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY indexname;
-- Resultado esperado: 10+ índices

---

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

SELECT 'RESUMEN FINAL' as "VERIFICACIÓN";

SELECT 
  'Portal Views' as "Componente",
  (SELECT COUNT(*) FROM pg_views WHERE viewname IN ('public_developments', 'client_lots', 'vista_pagos_cliente')) as "OK?"
UNION ALL
SELECT 
  'Funciones Utility',
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('calcular_recargo', 'generar_contrato_html', 'check_max_convenios_per_year'))
UNION ALL
SELECT 
  'Tablas Contratos',
  (SELECT COUNT(*) FROM pg_tables WHERE tablename IN ('contrato_template', 'contrato_generado', 'variables_disponibles'))
UNION ALL
SELECT 
  'RLS Habilitado',
  (SELECT COUNT(*) FROM pg_tables WHERE tablename IN ('cliente', 'venta', 'corridafinanciera', 'pagos', 'convenios') AND rowsecurity = true)
UNION ALL
SELECT 
  'Variables Config',
  (SELECT CASE WHEN COUNT(*) >= 25 THEN COUNT(*) ELSE 0 END FROM variables_disponibles)
UNION ALL
SELECT 
  'Trigger Convenios',
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'tg_max_convenios_per_year');

-- ============================================================================
-- DETALLES SI ALGO FALLÓ
-- ============================================================================

-- Si algún test falló, ejecuta esto para más detalles:

-- Ver todas las vistas creadas:
SELECT * FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;

-- Ver todas las funciones creadas:
SELECT proname FROM pg_proc WHERE prokind = 'f' ORDER BY proname;

-- Ver todas las tablas:
SELECT * FROM pg_tables WHERE schemaname = 'public';

-- Ver todas las políticas RLS:
SELECT * FROM pg_policies;

-- Ver todos los triggers:
SELECT * FROM pg_trigger;
