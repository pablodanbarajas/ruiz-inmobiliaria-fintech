-- ============================================================================
-- FIX: Corregir vista client_lots para excluir ventas canceladas
-- Ejecutar EN: SQL Editor del Portal Supabase
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
    WHEN v.estatus = 'V' THEN 'finalizado'
    WHEN v.estatus = 'P' THEN 'apartado'           -- Reserva pendiente de pago
    WHEN v.estatus = 'E' THEN 'apartado_confirmado' -- Apartado pagado, enganche pendiente
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
  v.monto_apartado_pagado,
  v.fecha_limite_enganche,
  (SELECT MIN(cf.fecha) FROM corridafinanciera cf 
   WHERE cf.ventaid = v.ventaid 
     AND cf.nopago > 0
     AND NOT EXISTS (
       SELECT 1 FROM pagos p 
       WHERE p.corridafinancieraid = cf.corridafinancieraid 
         AND p.estatus IN ('P', 'R')
     )
  ) as next_due_date,
  (SELECT cf.mensualidad + COALESCE(
     (SELECT SUM(ce.monto) FROM cargos_extra ce
      WHERE ce.loteid = l.loteid
        AND ce.estatus != 'X'
        AND ce.fecha <= cf.fecha
        AND (ce.fecha_fin IS NULL OR ce.fecha_fin >= cf.fecha)),
     0)
   FROM corridafinanciera cf
   WHERE cf.ventaid = v.ventaid
     AND cf.nopago > 0
     AND NOT EXISTS (
       SELECT 1 FROM pagos p
       WHERE p.corridafinancieraid = cf.corridafinancieraid
         AND p.estatus IN ('P', 'R')
     )
   ORDER BY cf.fecha ASC
   LIMIT 1
  ) as next_payment_amount
FROM cliente c
INNER JOIN venta v ON v.clienteid = c.clienteid
INNER JOIN lote l ON l.loteid = v.loteid
INNER JOIN desarrollo d ON d.desarrolloid = l.desarrolloid
WHERE c.email = auth.jwt() ->> 'email'
  AND v.estatus IN ('A', 'V', 'P', 'E')
ORDER BY d.nombre, l.manzana, l.nolote;

-- RLS: Solo clientes pueden ver sus lotes
ALTER TABLE public.client_lots OWNER TO postgres;
ALTER VIEW public.client_lots SET (security_invoker = on);
REVOKE ALL ON public.client_lots FROM anon;
GRANT SELECT ON public.client_lots TO authenticated;
