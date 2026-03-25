-- ============================================================
-- 3.7 Devoluciones en Cancelación
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla principal de devoluciones
CREATE TABLE IF NOT EXISTS devoluciones (
  devolucionid  SERIAL PRIMARY KEY,
  ventaid       INT NOT NULL REFERENCES venta(ventaid),
  clienteid     INT REFERENCES cliente(clienteid),
  monto_total   NUMERIC(12,2) NOT NULL,
  motivo        TEXT,
  estatus       VARCHAR(1) NOT NULL DEFAULT 'P',
  -- P: Pendiente | E: En proceso | C: Completada
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de parcialidades por devolución
CREATE TABLE IF NOT EXISTS devolucion_parcialidades (
  parcialidadid    SERIAL PRIMARY KEY,
  devolucionid     INT NOT NULL REFERENCES devoluciones(devolucionid) ON DELETE CASCADE,
  monto            NUMERIC(12,2) NOT NULL,
  fecha_programada DATE,
  fecha_pagada     DATE,
  estatus          VARCHAR(1) NOT NULL DEFAULT 'P',
  -- P: Pendiente | R: Realizada
  notas            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Activar RLS
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_parcialidades ENABLE ROW LEVEL SECURITY;

-- Políticas: solo administradores (mismo patrón que el resto del sistema)
CREATE POLICY "Admin full access devoluciones"
  ON devoluciones FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "Admin full access devolucion_parcialidades"
  ON devolucion_parcialidades FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');


-- ============================================================
-- 3.9 Tolerancia de Pago
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Columna en tabla venta para días de tolerancia antes de que aplique el recargo.
-- NULL / 0 = sin tolerancia (comportamiento por defecto, no cambia nada).
-- El admin lo activa manualmente por venta desde el formulario de edición.
ALTER TABLE venta
  ADD COLUMN IF NOT EXISTS dias_tolerancia INTEGER DEFAULT NULL;


-- ============================================================
-- 3.10 Cargos Extra por Servicios
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla de cargos extra vinculada a LOTE (no a venta)
-- Al aplicar un cargo a un desarrollo se insertan registros por cada lote.
-- Así las ventas nuevas del mismo lote heredan el cargo automáticamente,
-- y no hay riesgo de duplicar al re-aplicar (se omiten los ya existentes).
CREATE TABLE IF NOT EXISTS cargos_extra (
  cargoid      SERIAL PRIMARY KEY,
  loteid       INT NOT NULL REFERENCES lote(loteid),
  desarrolloid INT REFERENCES desarrollo(desarrolloid),  -- desnormalizado para filtrar rápido
  concepto     VARCHAR NOT NULL,
  monto        NUMERIC(12,2) NOT NULL,
  fecha        DATE NOT NULL,                             -- fecha de inicio del cargo (se cobra mensualmente)
  estatus      VARCHAR(1) NOT NULL DEFAULT 'P',
  -- P: Pendiente | C: Cobrado | X: Cancelado
  fecha_pago   DATE,
  referencia   VARCHAR,
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3.10 Migración: si ya creaste cargos_extra con ventaid
-- Ejecutar SOLO si la tabla ya existe con ventaid
-- ============================================================
-- ALTER TABLE cargos_extra ADD COLUMN IF NOT EXISTS loteid INT REFERENCES lote(loteid);
-- UPDATE cargos_extra ce SET loteid = v.loteid FROM venta v WHERE v.ventaid = ce.ventaid;
-- ALTER TABLE cargos_extra ALTER COLUMN loteid SET NOT NULL;
-- ALTER TABLE cargos_extra DROP COLUMN IF EXISTS ventaid;

ALTER TABLE cargos_extra ENABLE ROW LEVEL SECURITY;

-- Elimina la política anterior si existe (por si cambió el esquema de la tabla)
DROP POLICY IF EXISTS "Admin full access cargos_extra" ON cargos_extra;

CREATE POLICY "Admin full access cargos_extra"
  ON cargos_extra FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
