-- ============================================================================
-- VISTAS PARA PORTAL CLIENTE
-- ============================================================================
-- Estas vistas permiten que el portal cliente (portalCliente) acceda a datos
-- públicos y personalizados sin exposición directa a las tablas.
-- 
-- Importante: Las vistas usan Supabase Auth para filtrar datos por usuario
-- Requiere que los clientes estén autenticados con su email
-- ============================================================================

-- ============================================================================
-- FUNCIÓN AUXILIAR: calcular_recargo (DEFINIR PRIMERO)
-- Calcula recargo de $150 cada 6 días después del período de tolerancia
-- ============================================================================
DROP FUNCTION IF EXISTS public.calcular_recargo(date, int) CASCADE;

CREATE FUNCTION public.calcular_recargo(
  fecha_vencimiento date,
  dias_tolerancia int DEFAULT 0
)
RETURNS NUMERIC AS $$
DECLARE
  dias_atraso INT;
  periodos_6dias INT;
  recargo NUMERIC;
BEGIN
  -- Calcular días de atraso desde la fecha de vencimiento + tolerancia
  dias_atraso := (CURRENT_DATE - fecha_vencimiento) - COALESCE(dias_tolerancia, 0);
  
  IF dias_atraso <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Calcular cuántos períodos de 6 días han pasado
  periodos_6dias := CEIL(dias_atraso::NUMERIC / 6);
  
  -- $150 por cada período
  recargo := periodos_6dias * 150;
  
  RETURN recargo;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER FUNCTION public.calcular_recargo(date, int) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.calcular_recargo(date, int) TO anon, authenticated;

-- ============================================================================
-- Vista 1: public_developments
-- Desarrollos disponibles para el público (sin autenticación)
-- ============================================================================
DROP VIEW IF EXISTS public.public_developments CASCADE;

CREATE VIEW public.public_developments AS
SELECT
  d.desarrolloid as id,
  d.nombre as name,
  d.descripciondetallada as description,
  'Ubicación pendiente' as location,
  COALESCE(
    (SELECT COUNT(*) FROM lote l WHERE l.desarrolloid = d.desarrolloid AND l.estatus = 'D'),
    0
  ) as available_lots,
  '' as image_url,
  '' as google_maps_url,
  CAST(d.montominimoapartado AS DECIMAL(12,2)) as min_apartado,
  CAST(d.enganche AS DECIMAL(12,2)) as enganche
FROM desarrollo d
WHERE d.estatus = 'A'
ORDER BY d.nombre;

-- Permitir lectura pública
ALTER TABLE public.public_developments OWNER TO postgres;
REVOKE ALL ON public.public_developments FROM anon, authenticated;
GRANT SELECT ON public.public_developments TO anon, authenticated;

-- ============================================================================
-- Vista 2: client_lots
-- Lotes del cliente (requiere autenticación)
-- Filtra por email del usuario autenticado
-- ============================================================================
DROP VIEW IF EXISTS public.client_lots CASCADE;

CREATE VIEW public.client_lots AS
SELECT
  auth.uid() as user_id,
  c.clienteid,
  l.loteid as lot_id,
  COALESCE(
    l.clavelote,
    CONCAT('Mza-', l.manzana, '-Lote-', l.nolote)
  ) as lot_key,
  l.superficie,
  l.preciolote,
  l.estatus as lot_status,
  CASE 
    WHEN v.estatus = 'C' THEN 'finalizado'
    WHEN v.estatus = 'V' THEN 'finalizado'
    WHEN v.estatus = 'A' AND COALESCE(
      (SELECT COUNT(*) FROM corridafinanciera cf 
       WHERE cf.ventaid = v.ventaid AND cf.nopago > 0),
      0
    ) > 0 THEN 'en_pagos'
    WHEN v.estatus = 'A' THEN 'apartado'
    ELSE 'apartado'
  END as portal_lot_status,
  d.desarrolloid as development_id,
  d.nombre as development_name,
  d.descripcion as development_description,
  v.ventaid,
  v.estatus as sale_status,
  v.fechacontrato,
  v.enganche,
  v.mensualidad,
  (SELECT MIN(cf.fecha) FROM corridafinanciera cf 
   WHERE cf.ventaid = v.ventaid AND cf.nopago > 0) as next_due_date,
  v.mensualidad as next_payment_amount
FROM cliente c
INNER JOIN venta v ON v.clienteid = c.clienteid
INNER JOIN lote l ON l.loteid = v.loteid
INNER JOIN desarrollo d ON d.desarrolloid = l.desarrolloid
WHERE c.email = auth.jwt() ->> 'email'
  AND v.estatus IN ('A', 'C', 'V')
ORDER BY d.nombre, l.manzana, l.nolote;

-- RLS: Solo clientes pueden ver sus lotes
ALTER TABLE public.client_lots OWNER TO postgres;
ALTER VIEW public.client_lots SET (security_invoker = on);
REVOKE ALL ON public.client_lots FROM anon;
GRANT SELECT ON public.client_lots TO authenticated;

-- ============================================================================
-- Vista 3: vista_pagos_cliente
-- Pagos y corridas financieras del cliente
-- Requiere autenticación y filtra por email
-- ============================================================================
DROP VIEW IF EXISTS public.vista_pagos_cliente CASCADE;

CREATE VIEW public.vista_pagos_cliente AS
SELECT
  auth.uid() as user_id,
  c.clienteid,
  v.ventaid,
  l.loteid as lot_id,
  COALESCE(
    l.clavelote,
    CONCAT('Mza-', l.manzana, '-Lote-', l.nolote)
  ) as lot_key,
  d.desarrolloid as development_id,
  d.nombre as development_name,
  cf.corridafinancieraid,
  cf.nopago,
  'Mensualidad' as payment_type,
  cf.fecha as due_date,
  cf.mensualidad as scheduled_amount,
  COALESCE(
    (SELECT SUM(ce.monto) FROM cargos_extra ce 
     WHERE ce.desarrolloid = d.desarrolloid),
    0
  ) as cargo_extra_amount,
  CASE
    WHEN cf.fecha < CURRENT_DATE AND COALESCE(
      (SELECT COUNT(*) FROM pagos p 
       WHERE p.corridafinancieraid = cf.corridafinancieraid AND p.estatus IN ('P', 'R')),
      0
    ) = 0 THEN calcular_recargo(cf.fecha, v.dias_tolerancia)
    ELSE 0
  END as recargo_pendiente,
  v.dias_tolerancia,
  COALESCE(
    (SELECT SUM(p.montopagado) FROM pagos p 
     WHERE p.corridafinancieraid = cf.corridafinancieraid AND p.estatus IN ('P', 'R')),
    0
  ) as paid_amount,
  (SELECT MAX(p.fechapago) FROM pagos p 
   WHERE p.corridafinancieraid = cf.corridafinancieraid AND p.estatus IN ('P', 'R')) as last_paid_at,
  0 as recargo_pagado,
  0 as moratorio_pagado,
  CASE
    WHEN COALESCE(
      (SELECT COUNT(*) FROM pagos p 
       WHERE p.corridafinancieraid = cf.corridafinancieraid AND p.estatus IN ('P', 'R')),
      0
    ) > 0 THEN 'pagado'
    WHEN cf.fecha < CURRENT_DATE THEN 'atrasado'
    ELSE 'pendiente'
  END as payment_status
FROM cliente c
INNER JOIN venta v ON v.clienteid = c.clienteid
INNER JOIN lote l ON l.loteid = v.loteid
INNER JOIN desarrollo d ON d.desarrolloid = l.desarrolloid
INNER JOIN corridafinanciera cf ON cf.ventaid = v.ventaid
WHERE c.email = auth.jwt() ->> 'email'
  AND v.estatus IN ('A', 'C', 'V')
ORDER BY cf.fecha DESC;

-- RLS: Solo clientes pueden ver sus pagos
ALTER TABLE public.vista_pagos_cliente OWNER TO postgres;
ALTER VIEW public.vista_pagos_cliente SET (security_invoker = on);
REVOKE ALL ON public.vista_pagos_cliente FROM anon;
GRANT SELECT ON public.vista_pagos_cliente TO authenticated;

-- ============================================================================
-- ÍNDICES para mejor rendimiento
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cliente_email ON cliente(email);
CREATE INDEX IF NOT EXISTS idx_venta_clienteid ON venta(clienteid);
CREATE INDEX IF NOT EXISTS idx_lote_desarrolloid ON lote(desarrolloid);
CREATE INDEX IF NOT EXISTS idx_corridafinanciera_ventaid ON corridafinanciera(ventaid);
CREATE INDEX IF NOT EXISTS idx_pagos_corridafinancieraid ON pagos(corridafinancieraid);

-- ============================================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================================
COMMENT ON VIEW public.public_developments IS 'Desarrollos públicos sin autenticación requerida. Muestra información básica de desarrollos activos.';

COMMENT ON VIEW public.client_lots IS 'Lotes del cliente autenticado. Filtra por email del usuario y solo muestra sus lotes. Usa RLS (Row Level Security).';

COMMENT ON VIEW public.vista_pagos_cliente IS 'Pagos y corridas financieras pendientes del cliente autenticado. Calcula recargos automáticamente basado en fecha de vencimiento.';

COMMENT ON FUNCTION public.calcular_recargo IS 'Calcula recargo de $150 cada 6 días después del período de tolerancia. Se usa en vista_pagos_cliente.';
