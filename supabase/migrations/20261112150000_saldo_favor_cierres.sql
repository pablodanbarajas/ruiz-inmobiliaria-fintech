-- Saldo a favor when a sale is cancelled.
--
-- A sale's saldo a favor is money the client left ahead (abonos). When the
-- sale is cancelled, staff must decide what happens to it: refund it to the
-- client or retain it. This records that decision, who took it and when, so a
-- cancelled sale never keeps saldo without a known destination. A refund also
-- creates its devolución (one installment) in the same transaction.
--
-- The amount is always computed here, never sent by the app. Decisions are
-- written only by cerrar_saldo_favor and are never edited or deleted from the
-- app; a mistake is fixed by hand in the database.

-- ── Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saldo_favor_cierres (
  cierreid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ventaid integer NOT NULL UNIQUE REFERENCES public.venta (ventaid),
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  decision text NOT NULL CHECK (decision IN ('reembolso', 'retencion')),
  devolucionid integer REFERENCES public.devoluciones (devolucionid),
  nota text,
  created_by uuid NOT NULL,
  created_by_nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A refund always points at its devolución; a retention never does.
  CONSTRAINT saldo_favor_cierres_devolucion_check CHECK ((decision = 'reembolso') = (devolucionid IS NOT NULL))
);

ALTER TABLE public.saldo_favor_cierres ENABLE ROW LEVEL SECURITY;

-- Internal staff read it (same roles as devoluciones). No write policies:
-- only cerrar_saldo_favor writes, as SECURITY DEFINER.
DROP POLICY IF EXISTS saldo_favor_cierres_select_panel ON public.saldo_favor_cierres;
CREATE POLICY saldo_favor_cierres_select_panel ON public.saldo_favor_cierres
  FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

-- ── Saldo a favor of one sale ─────────────────────────────────────────────
-- Same rule as src/utils/pagos.ts: abonos (positive servicios_extra) minus
-- saldo used (saldo_favor_aplicado, or a negative servicios_extra in older
-- records), over payments that aren't cancelled.
CREATE OR REPLACE FUNCTION public.saldo_favor_venta(p_ventaid integer)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT GREATEST(0, round(COALESCE(sum(
      GREATEST(COALESCE(p.servicios_extra, 0), 0)
    - GREATEST(-COALESCE(p.servicios_extra, 0), 0)
    - GREATEST(COALESCE(p.saldo_favor_aplicado, 0), 0)
  ), 0), 2))
  FROM public.pagos p
  JOIN public.corridafinanciera c ON c.corridafinancieraid = p.corridafinancieraid
  WHERE c.ventaid = p_ventaid
    AND p.estatus IS DISTINCT FROM 'C'
$$;

-- ── Record the decision ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cerrar_saldo_favor(p_ventaid integer, p_decision text, p_nota text DEFAULT NULL)
 RETURNS TABLE (cierreid bigint, monto numeric, devolucionid integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_venta public.venta%ROWTYPE;
  v_monto numeric;
  v_devolucionid integer;
  v_cierreid bigint;
  v_nombre text;
BEGIN
  IF NOT COALESCE(public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'cobranza_caja', 'contratos']), false) THEN
    RAISE EXCEPTION 'No tienes permiso para decidir el saldo a favor' USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('reembolso', 'retencion') THEN
    RAISE EXCEPTION 'Decisión inválida: usa reembolso o retencion';
  END IF;

  -- The row lock serializes two people deciding the same sale at once.
  SELECT * INTO v_venta FROM public.venta v WHERE v.ventaid = p_ventaid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta no existe';
  END IF;
  IF v_venta.estatus IS DISTINCT FROM 'C' THEN
    RAISE EXCEPTION 'La venta no está cancelada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.saldo_favor_cierres s WHERE s.ventaid = p_ventaid) THEN
    RAISE EXCEPTION 'La venta ya tiene una decisión de saldo a favor';
  END IF;

  v_monto := public.saldo_favor_venta(p_ventaid);
  IF v_monto <= 0 THEN
    RAISE EXCEPTION 'La venta no tiene saldo a favor';
  END IF;

  IF p_decision = 'reembolso' THEN
    INSERT INTO public.devoluciones (ventaid, clienteid, monto_total, motivo, estatus)
    VALUES (p_ventaid, v_venta.clienteid, v_monto, 'Reembolso de saldo a favor', 'P')
    RETURNING devoluciones.devolucionid INTO v_devolucionid;

    INSERT INTO public.devolucion_parcialidades (devolucionid, monto, estatus, notas)
    VALUES (v_devolucionid, v_monto, 'P', 'Parcialidad 1 de 1');
  END IF;

  -- No users table with names: take it from the caller's session.
  v_nombre := COALESCE(
    NULLIF(trim(concat_ws(' ', auth.jwt() -> 'user_metadata' ->> 'nombre', auth.jwt() -> 'user_metadata' ->> 'apellido')), ''),
    auth.jwt() ->> 'email',
    'Usuario'
  );

  INSERT INTO public.saldo_favor_cierres (ventaid, monto, decision, devolucionid, nota, created_by, created_by_nombre)
  VALUES (p_ventaid, v_monto, p_decision, v_devolucionid, NULLIF(trim(p_nota), ''), auth.uid(), v_nombre)
  RETURNING saldo_favor_cierres.cierreid INTO v_cierreid;

  RETURN QUERY SELECT v_cierreid, v_monto, v_devolucionid;
END;
$$;

-- Only cerrar_saldo_favor uses it; the app computes the saldo with RLS.
REVOKE EXECUTE ON FUNCTION public.saldo_favor_venta(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cerrar_saldo_favor(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_saldo_favor(integer, text, text) TO authenticated;

-- ── No new saldo on a cancelled sale ──────────────────────────────────────
-- Rejects raising saldo_favor_aplicado on a payment of a cancelled sale, so
-- the saldo can't be spent after cancelling or after its decision. Editing
-- or cancelling an old payment of that sale still works.
CREATE OR REPLACE FUNCTION public.pagos_no_saldo_en_venta_cancelada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estatus IS DISTINCT FROM 'C'
     AND COALESCE(NEW.saldo_favor_aplicado, 0) >
         (CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.saldo_favor_aplicado, 0) ELSE 0 END)
     AND EXISTS (
       SELECT 1 FROM public.corridafinanciera c
       JOIN public.venta v ON v.ventaid = c.ventaid
       WHERE c.corridafinancieraid = NEW.corridafinancieraid AND v.estatus = 'C'
     ) THEN
    RAISE EXCEPTION 'No se puede usar saldo a favor de una venta cancelada' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pagos_no_saldo_en_venta_cancelada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pagos_no_saldo_en_venta_cancelada ON public.pagos;
CREATE TRIGGER pagos_no_saldo_en_venta_cancelada
  BEFORE INSERT OR UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.pagos_no_saldo_en_venta_cancelada();
