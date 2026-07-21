-- ============================================================
-- ELIMINAR CLIENTE 1000012 (Mbappe Gonzalez) Y TODOS SUS DATOS
-- EJECUTAR EN: SQL Editor de Supabase
--
-- Elimina en orden correcto respetando las FK:
--   pagos → corridafinanciera → venta → cliente
-- ============================================================

DO $$
DECLARE
  v_clienteid   INT := 1000012;
  v_ventaids    INT[];
  v_cfids       INT[];
  v_auth_id     UUID;
BEGIN

  -- Obtener IDs de ventas del cliente
  SELECT ARRAY_AGG(ventaid) INTO v_ventaids
  FROM venta WHERE clienteid = v_clienteid;

  RAISE NOTICE 'Ventas a eliminar: %', v_ventaids;

  IF v_ventaids IS NOT NULL THEN

    -- Obtener IDs de corrida financiera
    SELECT ARRAY_AGG(corridafinancieraid) INTO v_cfids
    FROM corridafinanciera WHERE ventaid = ANY(v_ventaids);

    -- 1. Pagos
    DELETE FROM pagos WHERE corridafinancieraid = ANY(v_cfids);
    RAISE NOTICE 'Pagos eliminados';

    -- 2. Convenios
    DELETE FROM convenios WHERE ventaid = ANY(v_ventaids);
    RAISE NOTICE 'Convenios eliminados';

    -- 3. Corrida financiera
    DELETE FROM corridafinanciera WHERE ventaid = ANY(v_ventaids);
    RAISE NOTICE 'Corrida financiera eliminada';

    -- 4. Contratos generados
    DELETE FROM contrato_generado WHERE ventaid = ANY(v_ventaids);
    RAISE NOTICE 'Contratos generados eliminados';

    -- 5. Devoluciones
    DELETE FROM devoluciones WHERE ventaid = ANY(v_ventaids);
    RAISE NOTICE 'Devoluciones eliminadas';

    -- 6. Restaurar estatus de lotes a Disponible
    UPDATE lote SET estatus = 'D'
    WHERE loteid IN (SELECT loteid FROM venta WHERE ventaid = ANY(v_ventaids))
      AND estatus IN ('A', 'V', 'P', 'E');
    RAISE NOTICE 'Lotes restaurados a Disponible';

    -- 7. Ventas
    DELETE FROM venta WHERE ventaid = ANY(v_ventaids);
    RAISE NOTICE 'Ventas eliminadas';

  END IF;

  -- 8. Devoluciones directas al cliente (sin venta)
  DELETE FROM devoluciones WHERE clienteid = v_clienteid;

  -- 9. Obtener auth.user_id antes de eliminar el cliente
  SELECT user_id INTO v_auth_id FROM cliente WHERE clienteid = v_clienteid;

  -- 10. Eliminar cliente
  DELETE FROM cliente WHERE clienteid = v_clienteid;
  RAISE NOTICE 'Cliente % eliminado', v_clienteid;

  -- 11. Eliminar usuario de auth.users (borra acceso al portal)
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
    RAISE NOTICE 'Auth user % eliminado', v_auth_id;
  END IF;

  RAISE NOTICE '✓ Eliminación completada correctamente';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error durante la eliminación: % — %', SQLSTATE, SQLERRM;
END;
$$;
