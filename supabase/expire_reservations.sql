-- ============================================================
-- expire_reservations()
-- Libera lotes cuya reserva (pago de apartado pendiente) lleva
-- más de 24 horas sin ser completada.
--
-- Condiciones para expirar:
--   venta.estatus = 'P'  (Pendiente de pago de apartado)
--   venta.fecha_reserva < NOW() - INTERVAL '24 hours'
--
-- Acciones:
--   1. Cancela la venta: estatus → 'C'
--   2. Libera el lote:   estatus → 'D'
--
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS public.expire_reservations();

CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Cancelar ventas pendientes expiradas
  UPDATE venta
  SET estatus = 'C'
  WHERE estatus = 'P'
    AND fecha_reserva IS NOT NULL
    AND fecha_reserva < NOW() - INTERVAL '24 hours';

  -- 2. Liberar lotes que quedaron bloqueados por reservas expiradas
  --    (lote.estatus = 'A' pero sin venta activa P/E/A/C_activa)
  UPDATE lote
  SET estatus = 'D'
  WHERE estatus = 'A'
    AND loteid IN (
      SELECT DISTINCT v.loteid
      FROM venta v
      WHERE v.estatus = 'C'
        AND v.fecha_reserva IS NOT NULL
        AND v.fecha_reserva < NOW() - INTERVAL '24 hours'
        -- Asegurarse de que NO haya otra venta activa sobre el mismo lote
        AND NOT EXISTS (
          SELECT 1 FROM venta v2
          WHERE v2.loteid = v.loteid
            AND v2.estatus IN ('P', 'E', 'A')
            -- Excluir ventas pendientes que también ya expiraron
            AND NOT (v2.estatus = 'P' AND v2.fecha_reserva < NOW() - INTERVAL '24 hours')
        )
    );
END;
$$;

-- Otorgar permisos de ejecución al rol de servicio (service_role)
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO service_role;
