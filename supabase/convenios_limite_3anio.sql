-- ============================================================================
-- VALIDACIÓN: LÍMITE DE 3 CONVENIOS POR AÑO POR VENTA
-- ============================================================================
-- Trigger que previene insertar más de 3 convenios en un año para la misma venta
-- Se ejecuta automáticamente al INSERT en tabla convenios
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: check_max_convenios_per_year
-- Valida que no existan más de 3 convenios por venta en el mismo año
-- ============================================================================
DROP FUNCTION IF EXISTS public.check_max_convenios_per_year() CASCADE;

CREATE FUNCTION public.check_max_convenios_per_year()
RETURNS TRIGGER AS $$
DECLARE
  v_count_convenios INT;
  v_year_nueva_fecha INT;
BEGIN
  -- Obtener el año de la nueva fecha
  v_year_nueva_fecha := EXTRACT(YEAR FROM NEW.fecha);
  
  -- Contar convenios existentes para esta venta en el mismo año
  SELECT COUNT(*) INTO v_count_convenios
  FROM convenios
  WHERE ventaid = NEW.ventaid
    AND EXTRACT(YEAR FROM fecha) = v_year_nueva_fecha
    AND estatus != 'C'; -- Excluir convenios cancelados
  
  -- Si ya existen 3 o más, rechazar
  IF v_count_convenios >= 3 THEN
    RAISE EXCEPTION 
      'No se puede crear más de 3 convenios por año para la venta #%. Ya existen % en %',
      NEW.ventaid,
      v_count_convenios,
      v_year_nueva_fecha;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dar permisos
ALTER FUNCTION public.check_max_convenios_per_year() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.check_max_convenios_per_year() TO public;

-- ============================================================================
-- TRIGGER: tg_max_convenios_per_year
-- Se ejecuta ANTES de INSERT en tabla convenios
-- ============================================================================
DROP TRIGGER IF EXISTS tg_max_convenios_per_year ON public.convenios;

CREATE TRIGGER tg_max_convenios_per_year
BEFORE INSERT ON public.convenios
FOR EACH ROW
EXECUTE FUNCTION check_max_convenios_per_year();

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON FUNCTION public.check_max_convenios_per_year() IS 
  'Valida que no existan más de 3 convenios por venta en el mismo año.';

COMMENT ON TRIGGER tg_max_convenios_per_year ON convenios IS
  'Trigger que enforza el límite de 3 convenios por año por venta.';

-- ============================================================================
-- TESTING
-- ============================================================================

/*
-- PARA TESTEAR EN SQL EDITOR:

-- 1. Ver cuántos convenios tiene una venta
SELECT COUNT(*) as convenios_2026
FROM convenios
WHERE ventaid = 1
  AND EXTRACT(YEAR FROM fecha) = 2026
  AND estatus != 'C';

-- 2. Intentar insertar un 4to convenio (debe fallar)
INSERT INTO convenios (ventaid, clienteid, fecha, motivo)
VALUES (1, 1, '2026-06-11'::date, 'Test 4to convenio');
-- RESULTADO: ERROR "No se puede crear más de 3 convenios por año"

-- 3. Ver que el trigger está activo
SELECT * FROM pg_trigger WHERE tgname = 'tg_max_convenios_per_year';

*/

-- ============================================================================
-- ÍNDICE PARA OPTIMIZAR EL QUERY DEL TRIGGER
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_convenios_ventaid_year 
ON convenios(ventaid, EXTRACT(YEAR FROM fecha))
WHERE estatus != 'C';

-- ============================================================================
-- FIN: VALIDACIÓN DE LÍMITE
-- ============================================================================
-- Generado: 2026-06-11
-- Estado: LISTO PARA PRODUCCIÓN
-- ============================================================================
