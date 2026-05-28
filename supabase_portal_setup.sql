-- ============================================================
-- Portal Cliente — Setup de Base de Datos
-- Ejecutar en el SQL Editor de Supabase, en orden
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PASO 1: Añadir user_id a la tabla cliente
-- Vincula cada cliente del admin con su cuenta en auth.users
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.cliente
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice único: un auth.user solo puede estar vinculado a un cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_user_id
  ON public.cliente(user_id)
  WHERE user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- PASO 2: Función y triggers de auto-vinculación
-- Cuando un cliente acepta su invitación (o se registra con el
-- mismo email), su auth.user.id se escribe automáticamente en
-- cliente.user_id sin intervención manual.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_auth_user_to_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cliente
  SET user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

-- Dispara al crear un usuario (registro normal)
DROP TRIGGER IF EXISTS trg_link_on_user_insert ON auth.users;
CREATE TRIGGER trg_link_on_user_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_auth_user_to_cliente();

-- Dispara cuando el usuario confirma su email (acepta invitación)
DROP TRIGGER IF EXISTS trg_link_on_invite_accept ON auth.users;
CREATE TRIGGER trg_link_on_invite_accept
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.link_auth_user_to_cliente();

-- ─────────────────────────────────────────────────────────────
-- PASO 3: Vista client_lots
-- Cada cliente autenticado solo ve sus propios lotes.
-- La vista corre con permisos del dueño (SECURITY DEFINER por
-- defecto) para poder leer las tablas admin, pero filtra
-- con auth.uid() para garantizar aislamiento.
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.client_lots;
CREATE VIEW public.client_lots AS
SELECT
  c.user_id,
  c.clienteid,
  l.loteid              AS lot_id,
  l.clavelote           AS lot_key,
  l.superficie,
  l.preciolote,
  l.estatus             AS lot_status,
  d.desarrolloid        AS development_id,
  d.nombre              AS development_name,
  d.descripcion         AS development_description,
  v.ventaid,
  v.estatus             AS sale_status,
  v.fechacontrato,
  v.enganche,
  v.mensualidad,
  -- Estado real del lote en el portal basado en pagos de la corrida financiera
  CASE
    WHEN l.estatus = 'A' THEN 'apartado'
    WHEN EXISTS (
      SELECT 1 FROM public.corridafinanciera cf_chk
      WHERE cf_chk.ventaid = v.ventaid AND cf_chk.nopago > 0
    ) AND NOT EXISTS (
      SELECT 1 FROM public.corridafinanciera cf2
      LEFT JOIN (
        SELECT corridafinancieraid, SUM(montopagado) AS total_pagado
        FROM public.pagos
        WHERE estatus IS DISTINCT FROM 'C'
        GROUP BY corridafinancieraid
      ) p2 ON p2.corridafinancieraid = cf2.corridafinancieraid
      WHERE cf2.ventaid = v.ventaid
        AND cf2.nopago > 0
        AND COALESCE(p2.total_pagado, 0) < cf2.mensualidad
    ) THEN 'finalizado'
    ELSE 'en_pagos'
  END AS portal_lot_status,
  -- Fecha del próximo pago pendiente (nopago > 0)
  (
    SELECT cf3.fecha
    FROM public.corridafinanciera cf3
    LEFT JOIN (
      SELECT corridafinancieraid, SUM(montopagado) AS total_pagado
      FROM public.pagos
      WHERE estatus IS DISTINCT FROM 'C'
      GROUP BY corridafinancieraid
    ) p3 ON p3.corridafinancieraid = cf3.corridafinancieraid
    WHERE cf3.ventaid = v.ventaid
      AND cf3.nopago > 0
      AND COALESCE(p3.total_pagado, 0) < cf3.mensualidad
    ORDER BY cf3.nopago ASC
    LIMIT 1
  ) AS next_due_date,
  -- Monto del próximo pago pendiente (mensualidad + cargos extra aplicables)
  (
    SELECT cf4.mensualidad + COALESCE((
      SELECT SUM(ce.monto)
      FROM public.cargos_extra ce
      WHERE ce.loteid = l.loteid
        AND ce.estatus IS DISTINCT FROM 'X'
        AND ce.fecha <= cf4.fecha
        AND cf4.nopago > 0
    ), 0)
    FROM public.corridafinanciera cf4
    LEFT JOIN (
      SELECT corridafinancieraid, SUM(montopagado) AS total_pagado
      FROM public.pagos
      WHERE estatus IS DISTINCT FROM 'C'
      GROUP BY corridafinancieraid
    ) p4 ON p4.corridafinancieraid = cf4.corridafinancieraid
    WHERE cf4.ventaid = v.ventaid
      AND cf4.nopago > 0
      AND COALESCE(p4.total_pagado, 0) < cf4.mensualidad
    ORDER BY cf4.nopago ASC
    LIMIT 1
  ) AS next_payment_amount
FROM public.cliente       c
JOIN public.venta         v  ON v.clienteid    = c.clienteid
JOIN public.lote          l  ON l.loteid       = v.loteid
JOIN public.desarrollo    d  ON d.desarrolloid = l.desarrolloid
WHERE c.user_id IS NOT NULL
  AND c.user_id = auth.uid()
  AND v.estatus IS DISTINCT FROM 'C';  -- Excluir ventas canceladas

REVOKE ALL   ON public.client_lots FROM anon;
GRANT SELECT ON public.client_lots TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- PASO 4: Vista vista_pagos_cliente
-- Calcula el estado de pago de cada cuota de la corrida
-- financiera, agregando los pagos realizados (tabla pagos).
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vista_pagos_cliente;
CREATE VIEW public.vista_pagos_cliente AS
SELECT
  c.user_id,
  c.clienteid,
  v.ventaid,
  l.loteid              AS lot_id,
  l.clavelote           AS lot_key,
  d.desarrolloid        AS development_id,
  d.nombre              AS development_name,
  cf.corridafinancieraid,
  cf.nopago,
  CASE
    WHEN cf.nopago = 0 THEN 'Apartado'
    WHEN cf.nopago = 1 THEN 'Enganche'
    ELSE 'Mensualidad'
  END                             AS payment_type,
  cf.fecha                        AS due_date,
  cf.mensualidad                  AS scheduled_amount,
  -- Cargos extra activos (no cancelados) cuya fecha de inicio <= fecha de esta cuota.
  -- Solo aplica a mensualidades y enganche (nopago > 0), nunca al apartado (nopago = 0).
  COALESCE((
    SELECT SUM(ce.monto)
    FROM public.cargos_extra ce
    WHERE ce.loteid = l.loteid
      AND ce.estatus IS DISTINCT FROM 'X'
      AND ce.fecha <= cf.fecha
      AND cf.nopago > 0
  ), 0)                           AS cargo_extra_amount,
  -- Recargo por mora pendiente: $150 por cada 6 días vencidos, respetando dias_tolerancia.
  -- Solo aplica si la cuota está vencida y no pagada.
  CASE
    WHEN COALESCE(agg.total_pagado, 0) >= cf.mensualidad THEN 0
    WHEN cf.fecha >= CURRENT_DATE THEN 0
    ELSE GREATEST(0,
      FLOOR(
        (GREATEST(0, (CURRENT_DATE - cf.fecha::date) - COALESCE(v.dias_tolerancia, 0)))
        / 6
      ) * 150
    )
  END                             AS recargo_pendiente,
  v.dias_tolerancia,
  COALESCE(agg.total_pagado,  0)  AS paid_amount,
  agg.ultima_fecha                AS last_paid_at,
  COALESCE(agg.total_recargo, 0)  AS recargo_pagado,
  0                               AS moratorio_pagado,
  CASE
    WHEN COALESCE(agg.total_pagado, 0) >= cf.mensualidad THEN 'pagado'
    WHEN cf.fecha < CURRENT_DATE                         THEN 'atrasado'
    ELSE 'pendiente'
  END                             AS payment_status
FROM public.cliente              c
JOIN public.venta                v   ON v.clienteid        = c.clienteid
JOIN public.lote                 l   ON l.loteid           = v.loteid
JOIN public.desarrollo           d   ON d.desarrolloid     = l.desarrolloid
JOIN public.corridafinanciera    cf  ON cf.ventaid         = v.ventaid
LEFT JOIN (
  SELECT
    corridafinancieraid,
    SUM(montopagado)              AS total_pagado,
    SUM(COALESCE(recargo, 0))     AS total_recargo,
    MAX(fechapago)                AS ultima_fecha
  FROM public.pagos
  WHERE estatus IS DISTINCT FROM 'C'
  GROUP BY corridafinancieraid
) agg ON agg.corridafinancieraid = cf.corridafinancieraid
WHERE c.user_id IS NOT NULL
  AND c.user_id = auth.uid()
  AND v.estatus IS DISTINCT FROM 'C';

REVOKE ALL   ON public.vista_pagos_cliente FROM anon;
GRANT SELECT ON public.vista_pagos_cliente TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- PASO 5: Vista portal_invite_candidates (uso exclusivo admin)
-- Lista clientes con lotes activos por desarrollo.
-- El admin la filtra por development_id en la UI.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.portal_invite_candidates AS
SELECT
  c.clienteid,
  c.nombre,
  c.email,
  c.telefonocelular,
  c.user_id,
  d.desarrolloid        AS development_id,
  d.nombre              AS development_name,
  COUNT(DISTINCT l.loteid) AS num_lotes
FROM public.cliente       c
JOIN public.venta         v  ON v.clienteid    = c.clienteid
                             AND v.estatus     IS DISTINCT FROM 'C'
JOIN public.lote          l  ON l.loteid       = v.loteid
JOIN public.desarrollo    d  ON d.desarrolloid = l.desarrolloid
WHERE c.email IS NOT NULL
  AND TRIM(c.email) <> ''
GROUP BY
  c.clienteid, c.nombre, c.email, c.telefonocelular, c.user_id,
  d.desarrolloid, d.nombre;

GRANT SELECT ON public.portal_invite_candidates TO authenticated;
