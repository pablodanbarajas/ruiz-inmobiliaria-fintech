-- ============================================================================
-- FIX: Corregir vista vista_pagos_cliente para excluir ventas canceladas
-- Ejecutar EN: SQL Editor del Portal Supabase
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
  AND v.estatus IN ('A', 'V')
ORDER BY cf.fecha DESC;

-- RLS: Solo clientes pueden ver sus pagos
ALTER TABLE public.vista_pagos_cliente OWNER TO postgres;
ALTER VIEW public.vista_pagos_cliente SET (security_invoker = on);
REVOKE ALL ON public.vista_pagos_cliente FROM anon;
GRANT SELECT ON public.vista_pagos_cliente TO authenticated;
