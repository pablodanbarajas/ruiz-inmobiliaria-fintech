-- =============================================================
-- VENTAS EXTERNAS — Setup SQL
-- Fecha: 2026-07-17
-- Descripción: Soporte para el módulo de ventas externas.
--   Agrega el rol 'vendedor_externo' a la restricción de
--   user_roles.role y configura las políticas RLS para que
--   los vendedores externos solo vean sus propios registros.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Agregar 'vendedor_externo' al CHECK de user_roles
-- ─────────────────────────────────────────────────────────────
-- Primero eliminamos el constraint existente y lo recreamos
-- incluyendo el nuevo rol.  Ajusta el nombre del constraint
-- si difiere en tu instancia (ver pg_constraint).

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (
    role IN (
      'admin',
      'finanzas',
      'vendedor',
      'vendedor_externo',
      'contratos',
      'cobranza_caja'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Índice en venta.usuarioid (mejora consultas por vendedor)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_venta_usuarioid
  ON public.venta (usuarioid);

-- ─────────────────────────────────────────────────────────────
-- 3. Row Level Security en tabla venta
-- ─────────────────────────────────────────────────────────────
-- Habilitar RLS si aún no está activo
ALTER TABLE public.venta ENABLE ROW LEVEL SECURITY;

-- Política para admin / finanzas / contratos / cobranza_caja:
-- acceso total de lectura
CREATE POLICY "admin_read_all_ventas"
  ON public.venta
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role IN ('admin', 'finanzas', 'contratos', 'cobranza_caja')
    )
  );

-- Política para vendedor_externo:
-- solo puede leer sus propias ventas (usuarioid = auth.uid()::text)
CREATE POLICY "vendedor_externo_read_own_ventas"
  ON public.venta
  FOR SELECT
  USING (
    usuarioid = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  );

-- Política de inserción para vendedor_externo:
-- solo puede insertar ventas con su propio usuarioid
CREATE POLICY "vendedor_externo_insert_own_ventas"
  ON public.venta
  FOR INSERT
  WITH CHECK (
    usuarioid = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. RLS en tabla cliente
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;

-- Admin / contratos: acceso total
CREATE POLICY "admin_read_all_clientes"
  ON public.cliente
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role IN ('admin', 'finanzas', 'contratos', 'cobranza_caja')
    )
  );

-- Vendedor externo puede leer todos los clientes (para buscar existentes)
CREATE POLICY "vendedor_externo_read_clientes"
  ON public.cliente
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  );

-- Vendedor externo puede insertar clientes
CREATE POLICY "vendedor_externo_insert_clientes"
  ON public.cliente
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. RLS en tabla lote (lectura para vendedor_externo)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.lote ENABLE ROW LEVEL SECURITY;

-- Vendedor externo puede leer lotes disponibles
CREATE POLICY "vendedor_externo_read_lotes"
  ON public.lote
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  );

-- Vendedor externo puede actualizar estatus del lote (D → A al apartar)
CREATE POLICY "vendedor_externo_update_lote_estatus"
  ON public.lote
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
        AND ur.role = 'vendedor_externo'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. Verificación: listar roles registrados
-- ─────────────────────────────────────────────────────────────
-- SELECT user_id, role FROM public.user_roles ORDER BY role;

-- =============================================================
-- NOTAS DE APLICACIÓN
-- =============================================================
-- • Aplicar en Supabase SQL Editor (con permisos de superusuario).
-- • Si ya existen políticas con el mismo nombre, ejecutar primero:
--     DROP POLICY IF EXISTS "nombre_politica" ON public.tabla;
-- • Después de aplicar, verificar con:
--     SELECT * FROM pg_policies WHERE tablename IN ('venta','cliente','lote');
-- • Para crear un usuario vendedor_externo, usar el panel de
--   Usuarios en el admin (/admin/usuarios) y asignar el rol
--   'vendedor_externo'.
-- =============================================================
