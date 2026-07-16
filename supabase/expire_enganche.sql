-- ============================================================
-- expire_enganche()
-- Libera lotes cuya fase de enganche (apartado pagado) lleva
-- más de 15 días sin completarse.
--
-- Condiciones para expirar:
--   venta.estatus = 'E'  (En enganche — apartado pagado, esperando enganche)
--   venta.fecha_limite_enganche < CURRENT_DATE
--
-- Acciones:
--   1. Cancela la venta: estatus → 'C'
--   2. Libera el lote:   estatus → 'D'
--
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS public.expire_enganche();

CREATE OR REPLACE FUNCTION public.expire_enganche()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Cancelar ventas en enganche que superaron la fecha límite
  UPDATE venta
  SET estatus = 'C'
  WHERE estatus = 'E'
    AND fecha_limite_enganche IS NOT NULL
    AND fecha_limite_enganche < CURRENT_DATE;

  -- 2. Liberar lotes que quedaron bloqueados por enganche expirado
  UPDATE lote
  SET estatus = 'D'
  WHERE estatus = 'A'
    AND loteid IN (
      SELECT DISTINCT v.loteid
      FROM venta v
      WHERE v.estatus = 'C'
        AND v.fecha_limite_enganche IS NOT NULL
        AND v.fecha_limite_enganche < CURRENT_DATE
        -- Asegurar que NO haya otra venta activa sobre el mismo lote
        AND NOT EXISTS (
          SELECT 1 FROM venta v2
          WHERE v2.loteid = v.loteid
            AND v2.estatus IN ('P', 'E', 'A')
            AND NOT (v2.estatus = 'P' AND v2.fecha_reserva < NOW() - INTERVAL '24 hours')
            AND NOT (v2.estatus = 'E' AND v2.fecha_limite_enganche < CURRENT_DATE)
        )
    );
END;
$$;

-- Otorgar permisos al rol de servicio
GRANT EXECUTE ON FUNCTION public.expire_enganche() TO service_role;
