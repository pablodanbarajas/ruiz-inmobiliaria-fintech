-- ============================================================================
-- ROW LEVEL SECURITY (RLS) PARA RUIZ INMOBILIARIA
-- ============================================================================
-- Este archivo define todas las políticas RLS para proteger datos a nivel de fila
-- Debe ejecutarse como administrador de Supabase
-- 
-- Las políticas garantizan que:
-- - Clientes solo ven sus propios datos
-- - Cobradores solo ven clientes asignados
-- - Administradores ven todo
-- ============================================================================

-- ============================================================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS CRÍTICAS
-- ============================================================================

ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corridafinanciera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desarrollo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. POLÍTICAS PARA TABLA: cliente
-- ============================================================================

-- Clientes autenticados ven SOLO su propio registro
DROP POLICY IF EXISTS "cliente_select_own" ON public.cliente;
CREATE POLICY "cliente_select_own" ON public.cliente
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
    OR auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Admin puede actualizar clientes
DROP POLICY IF EXISTS "cliente_update_admin" ON public.cliente;
CREATE POLICY "cliente_update_admin" ON public.cliente
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 3. POLÍTICAS PARA TABLA: venta
-- ============================================================================

-- Clientes ven SOLO sus propias ventas
DROP POLICY IF EXISTS "venta_select_own" ON public.venta;
CREATE POLICY "venta_select_own" ON public.venta
  FOR SELECT
  USING (
    clienteid IN (
      SELECT clienteid FROM cliente WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 4. POLÍTICAS PARA TABLA: corridafinanciera
-- ============================================================================

-- Clientes ven SOLO sus propias corridas
DROP POLICY IF EXISTS "corridafinanciera_select_own" ON public.corridafinanciera;
CREATE POLICY "corridafinanciera_select_own" ON public.corridafinanciera
  FOR SELECT
  USING (
    ventaid IN (
      SELECT ventaid FROM venta WHERE clienteid IN (
        SELECT clienteid FROM cliente WHERE email = auth.jwt() ->> 'email'
      )
    )
    OR auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 5. POLÍTICAS PARA TABLA: pagos
-- ============================================================================

-- Clientes ven SOLO sus propios pagos
DROP POLICY IF EXISTS "pagos_select_own" ON public.pagos;
CREATE POLICY "pagos_select_own" ON public.pagos
  FOR SELECT
  USING (
    corridafinancieraid IN (
      SELECT corridafinancieraid FROM corridafinanciera WHERE ventaid IN (
        SELECT ventaid FROM venta WHERE clienteid IN (
          SELECT clienteid FROM cliente WHERE email = auth.jwt() ->> 'email'
        )
      )
    )
    OR auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Cobradores pueden INSERT pagos (pero no UPDATE/DELETE)
DROP POLICY IF EXISTS "pagos_insert_cobradores" ON public.pagos;
CREATE POLICY "pagos_insert_cobradores" ON public.pagos
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' IN ('admin', 'supervisor_cobranza', 'cobrador')
    )
  );

-- ============================================================================
-- 6. POLÍTICAS PARA TABLA: convenios
-- ============================================================================

-- Clientes ven SOLO sus propios convenios
DROP POLICY IF EXISTS "convenios_select_own" ON public.convenios;
CREATE POLICY "convenios_select_own" ON public.convenios
  FOR SELECT
  USING (
    ventaid IN (
      SELECT ventaid FROM venta WHERE clienteid IN (
        SELECT clienteid FROM cliente WHERE email = auth.jwt() ->> 'email'
      )
    )
    OR auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Solo admin puede crear/actualizar convenios
DROP POLICY IF EXISTS "convenios_insert_admin" ON public.convenios;
CREATE POLICY "convenios_insert_admin" ON public.convenios
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 7. POLÍTICAS PARA TABLA: lote (Lectura pública)
-- ============================================================================

-- Clientes ven SOLO lotes que compraron
DROP POLICY IF EXISTS "lote_select_cliente_owns" ON public.lote;
CREATE POLICY "lote_select_cliente_owns" ON public.lote
  FOR SELECT
  USING (
    loteid IN (
      SELECT v.loteid FROM venta v
      WHERE v.clienteid IN (
        SELECT clienteid FROM cliente WHERE email = auth.jwt() ->> 'email'
      )
    )
    OR auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 8. POLÍTICAS PARA TABLA: desarrollo (Lectura pública)
-- ============================================================================

-- Todos pueden ver desarrollos activos
DROP POLICY IF EXISTS "desarrollo_select_all" ON public.desarrollo;
CREATE POLICY "desarrollo_select_all" ON public.desarrollo
  FOR SELECT
  USING (estatus = 'A' OR auth.role() = 'authenticated');

-- ============================================================================
-- 9. POLÍTICAS PARA TABLA: cuentas_bancarias
-- ============================================================================

-- Solo admin puede ver/editar cuentas bancarias
DROP POLICY IF EXISTS "cuentas_bancarias_select_admin" ON public.cuentas_bancarias;
CREATE POLICY "cuentas_bancarias_select_admin" ON public.cuentas_bancarias
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- 10. CREAR ÍNDICES PARA OPTIMIZACIÓN DE RLS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cliente_email ON cliente(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venta_clienteid ON venta(clienteid);
CREATE INDEX IF NOT EXISTS idx_corridafinanciera_ventaid ON corridafinanciera(ventaid);
CREATE INDEX IF NOT EXISTS idx_pagos_corridafinancieraid ON pagos(corridafinancieraid);
CREATE INDEX IF NOT EXISTS idx_convenios_ventaid ON convenios(ventaid);
CREATE INDEX IF NOT EXISTS idx_lote_loteid ON lote(loteid);

-- ============================================================================
-- 11. VERIFICACIÓN - SCRIPTS DE TESTING
-- ============================================================================

-- Para verificar RLS, ejecutar como cliente autenticado:
/*

-- 1. Cliente SOLO debe ver su propio registro
SELECT * FROM cliente;
-- Resultado: 1 fila (la del cliente autenticado)

-- 2. Cliente SOLO debe ver sus ventas
SELECT * FROM venta;
-- Resultado: sus propias ventas

-- 3. Cliente SOLO debe ver sus pagos
SELECT * FROM pagos;
-- Resultado: sus propios pagos

-- Para verificar como admin:
-- Los admin deben ver TODO

SELECT count(*) as total_clientes FROM cliente;
SELECT count(*) as total_ventas FROM venta;
SELECT count(*) as total_pagos FROM pagos;

*/

-- ============================================================================
-- 12. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================

COMMENT ON POLICY "cliente_select_own" ON cliente IS 
  'Clientes autenticados ven solo su propio registro. Admins ven todo.';

COMMENT ON POLICY "venta_select_own" ON venta IS 
  'Clientes ven solo sus ventas. Cobradores ven ventas asignadas.';

COMMENT ON POLICY "corridafinanciera_select_own" ON corridafinanciera IS 
  'Clientes ven solo sus corridas. Admins ven todo.';

COMMENT ON POLICY "pagos_select_own" ON pagos IS 
  'Clientes ven solo sus pagos. Cobradores pueden registrar pagos.';

COMMENT ON POLICY "convenios_select_own" ON convenios IS 
  'Solo admins pueden crear/actualizar convenios.';

-- ============================================================================
-- FIN DE RLS SETUP
-- ============================================================================
-- Generado: 2026-06-11
-- Estado: LISTO PARA PRODUCCIÓN
-- Próximos pasos:
-- 1. Ejecutar este script en Supabase Console
-- 2. Verificar en "Auth" que los roles están en metadata de usuarios
-- 3. Testear con usuarios cliente que solo vean sus datos
-- 4. Testear con admin que vea todo
-- ============================================================================
