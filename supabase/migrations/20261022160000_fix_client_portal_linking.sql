-- Hace que el portal dependa del vínculo cliente.user_id y no del formato del correo.
-- También permite reparar de forma segura el vínculo del usuario autenticado.

CREATE OR REPLACE FUNCTION public.repair_my_cliente_link()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(auth.jwt() ->> 'email'));
  v_clienteid integer;
  v_matches integer;
BEGIN
  IF v_user_id IS NULL OR v_email IS NULL OR v_email = '' THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cliente
    WHERE user_id = v_user_id
  ) THEN
    RETURN true;
  END IF;

  SELECT COUNT(*), MIN(clienteid)
  INTO v_matches, v_clienteid
  FROM public.cliente
  WHERE lower(trim(email)) = v_email
    AND user_id IS NULL;

  IF v_matches <> 1 THEN
    RETURN false;
  END IF;

  UPDATE public.cliente
  SET user_id = v_user_id
  WHERE clienteid = v_clienteid
    AND user_id IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_my_cliente_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_my_cliente_link() TO authenticated;

CREATE OR REPLACE VIEW public.client_lots AS
SELECT
  auth.uid() AS user_id,
  c.clienteid,
  l.loteid AS lot_id,
  COALESCE(l.clavelote, CONCAT('Mza-', l.manzana, '-Lote-', l.nolote)) AS lot_key,
  l.superficie,
  l.preciolote,
  l.estatus AS lot_status,
  CASE
    WHEN v.estatus = 'V' THEN 'finalizado'
    WHEN v.estatus = 'P' THEN 'apartado'
    WHEN v.estatus = 'E' THEN 'apartado_confirmado'
    WHEN v.estatus = 'A' AND COALESCE((
      SELECT COUNT(*) FROM corridafinanciera cf
      WHERE cf.ventaid = v.ventaid AND cf.nopago > 0
    ), 0) > 0 THEN 'en_pagos'
    WHEN v.estatus = 'A' THEN 'en_formalizacion'
    ELSE 'apartado'
  END AS portal_lot_status,
  d.desarrolloid AS development_id,
  d.nombre AS development_name,
  d.descripcion AS development_description,
  v.ventaid,
  v.estatus AS sale_status,
  v.fechacontrato,
  v.enganche,
  v.mensualidad,
  v.monto_apartado_pagado,
  v.fecha_limite_enganche,
  (
    SELECT MIN(cf.fecha)
    FROM corridafinanciera cf
    WHERE cf.ventaid = v.ventaid
      AND cf.nopago > 0
      AND NOT EXISTS (
        SELECT 1 FROM pagos p
        WHERE p.corridafinancieraid = cf.corridafinancieraid
          AND p.estatus IN ('P', 'R')
      )
  ) AS next_due_date,
  (
    SELECT cf.mensualidad
      + COALESCE((
        SELECT SUM(ce.monto)
        FROM cargos_extra ce
        WHERE ce.loteid = l.loteid
          AND ce.estatus <> 'X'
          AND ce.fecha <= cf.fecha
          AND (ce.fecha_fin IS NULL OR ce.fecha_fin >= cf.fecha)
      ), 0)
      + CASE
          WHEN cf.fecha < CURRENT_DATE THEN calcular_recargo(cf.fecha, v.dias_tolerancia)
          ELSE 0
        END
    FROM corridafinanciera cf
    WHERE cf.ventaid = v.ventaid
      AND cf.nopago > 0
      AND NOT EXISTS (
        SELECT 1 FROM pagos p
        WHERE p.corridafinancieraid = cf.corridafinancieraid
          AND p.estatus IN ('P', 'R')
      )
    ORDER BY cf.fecha
    LIMIT 1
  ) AS next_payment_amount
FROM cliente c
JOIN venta v ON v.clienteid = c.clienteid
JOIN lote l ON l.loteid = v.loteid
JOIN desarrollo d ON d.desarrolloid = l.desarrolloid
WHERE c.user_id = auth.uid()
  AND v.estatus IN ('A', 'V', 'P', 'E')
ORDER BY d.nombre, l.manzana, l.nolote;

CREATE OR REPLACE VIEW public.vista_pagos_cliente AS
SELECT
  auth.uid() AS user_id,
  c.clienteid,
  v.ventaid,
  l.loteid AS lot_id,
  COALESCE(l.clavelote, CONCAT('Mza-', l.manzana, '-Lote-', l.nolote)) AS lot_key,
  d.desarrolloid AS development_id,
  d.nombre AS development_name,
  cf.corridafinancieraid,
  cf.nopago,
  'Mensualidad' AS payment_type,
  cf.fecha AS due_date,
  cf.mensualidad AS scheduled_amount,
  CASE
    WHEN cf.nopago = 0 THEN 0
    ELSE COALESCE((
      SELECT SUM(ce.monto)
      FROM cargos_extra ce
      WHERE ce.loteid = l.loteid
        AND ce.fecha <= cf.fecha
        AND (ce.fecha_fin IS NULL OR ce.fecha_fin >= cf.fecha)
    ), 0)
  END AS cargo_extra_amount,
  CASE
    WHEN cf.fecha < CURRENT_DATE AND COALESCE((
      SELECT COUNT(*) FROM pagos p
      WHERE p.corridafinancieraid = cf.corridafinancieraid
        AND p.estatus IN ('P', 'R')
    ), 0) = 0 THEN calcular_recargo(cf.fecha, v.dias_tolerancia)
    ELSE 0
  END AS recargo_pendiente,
  v.dias_tolerancia,
  COALESCE((
    SELECT SUM(p.montopagado)
    FROM pagos p
    WHERE p.corridafinancieraid = cf.corridafinancieraid
      AND p.estatus IN ('P', 'R')
  ), 0) AS paid_amount,
  (
    SELECT MAX(p.fechapago)
    FROM pagos p
    WHERE p.corridafinancieraid = cf.corridafinancieraid
      AND p.estatus IN ('P', 'R')
  ) AS last_paid_at,
  0 AS recargo_pagado,
  0 AS moratorio_pagado,
  CASE
    WHEN COALESCE((
      SELECT COUNT(*) FROM pagos p
      WHERE p.corridafinancieraid = cf.corridafinancieraid
        AND p.estatus IN ('P', 'R')
    ), 0) > 0 THEN 'pagado'
    WHEN cf.fecha < CURRENT_DATE THEN 'atrasado'
    ELSE 'pendiente'
  END AS payment_status
FROM cliente c
JOIN venta v ON v.clienteid = c.clienteid
JOIN lote l ON l.loteid = v.loteid
JOIN desarrollo d ON d.desarrolloid = l.desarrolloid
JOIN corridafinanciera cf ON cf.ventaid = v.ventaid
WHERE c.user_id = auth.uid()
  AND v.estatus IN ('A', 'V')
ORDER BY cf.fecha DESC;

CREATE OR REPLACE VIEW public.client_payment_summary AS
WITH client_saldos AS (
  SELECT
    c.clienteid,
    c.email,
    v.ventaid,
    l.loteid,
    COALESCE(v.preciolote, 0) AS precio_lote,
    COALESCE((
      SELECT SUM(p.montopagado)
      FROM pagos p
      JOIN corridafinanciera cf ON p.corridafinancieraid = cf.corridafinancieraid
      WHERE cf.ventaid = v.ventaid AND p.estatus <> 'C'
    ), 0) AS total_pagado
  FROM cliente c
  JOIN venta v ON v.clienteid = c.clienteid
  JOIN lote l ON l.loteid = v.loteid
  WHERE c.user_id = auth.uid()
    AND v.estatus IN ('A', 'V')
)
SELECT
  clienteid,
  email,
  auth.uid() AS user_id,
  SUM(precio_lote) AS precio_total,
  SUM(total_pagado) AS total_pagado,
  SUM(precio_lote) - SUM(total_pagado) AS saldo_pendiente,
  (
    SELECT COUNT(DISTINCT corridafinancieraid)
    FROM corridafinanciera
    WHERE ventaid IN (
      SELECT ventaid FROM client_saldos WHERE clienteid = cs.clienteid
    )
      AND nopago > 0
  ) AS pagos_pendientes
FROM client_saldos cs
GROUP BY clienteid, email;

ALTER VIEW public.client_lots SET (security_invoker = true);
ALTER VIEW public.vista_pagos_cliente SET (security_invoker = true);
ALTER VIEW public.client_payment_summary SET (security_invoker = true);

REVOKE ALL ON public.client_lots FROM PUBLIC, anon;
GRANT SELECT ON public.client_lots TO authenticated;
REVOKE ALL ON public.vista_pagos_cliente FROM PUBLIC, anon;
GRANT SELECT ON public.vista_pagos_cliente TO authenticated;
REVOKE ALL ON public.client_payment_summary FROM PUBLIC, anon;
GRANT SELECT ON public.client_payment_summary TO authenticated;
