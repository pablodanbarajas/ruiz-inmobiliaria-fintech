-- External sellers (vendedor_externo) see and change only their own work.
--
-- Until now the *_panel_all policies included vendedor_externo, so these
-- users (sellers outside the company) could read and change every client,
-- sale, payment, schedule and refund through the API. Their screen
-- (Ventas Externas) only needs to:
--   - read the lot catalog (lote_select_authenticated already allows it),
--   - create clients and reservations,
--   - read and edit their own sales and those sales' clients,
--   - reserve a free lot and release it again.
--
-- The older vendedor_externo_* policies never took effect (panel_all granted
-- everything) and were wrong: the sale ones compared usuarioid, but the app
-- stores the seller in vendedor_user_id, and the client one allowed reading
-- every client. They are replaced here.

-- ── Who is an external seller ────────────────────────────────────────────
-- Someone who also holds an internal role keeps the internal access.
-- has_admin_panel_role returns NULL, not false, when the JWT has no
-- app_metadata role and the user lacks the role, hence the COALESCE.
CREATE OR REPLACE FUNCTION public.is_vendedor_externo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.has_admin_panel_role(ARRAY['vendedor_externo']), false)
     AND NOT COALESCE(public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri']), false)
$$;

-- True when someone else's active sale holds the lot. SECURITY DEFINER because
-- an external seller can't see other people's sales through RLS.
CREATE OR REPLACE FUNCTION public.lote_apartado_por_otro(p_loteid integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venta v
    WHERE v.loteid = p_loteid
      AND v.estatus IN ('P', 'E', 'A')
      AND v.vendedor_user_id IS DISTINCT FROM auth.uid()::text
  )
$$;

-- Clients on the caller's own sales. SECURITY DEFINER so the cliente policy
-- doesn't query venta through RLS: venta_select_own already queries cliente,
-- and the two policies would recurse into each other.
CREATE OR REPLACE FUNCTION public.clientes_de_mis_ventas()
 RETURNS SETOF integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT v.clienteid FROM public.venta v
  WHERE v.vendedor_user_id = auth.uid()::text AND v.clienteid IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.is_vendedor_externo() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clientes_de_mis_ventas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clientes_de_mis_ventas() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.lote_apartado_por_otro(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_vendedor_externo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lote_apartado_por_otro(integer) TO authenticated;

-- ── Internal staff policies: drop vendedor_externo ───────────────────────
DO $$
DECLARE
  target record;
  internal constant text := '(SELECT public.has_admin_panel_role(ARRAY[''admin'', ''finanzas'', ''vendedor'', ''contratos'', ''cobranza_caja'', ''desarrollo_ri'']))';
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('cargos_extra'), ('cliente'), ('corridafinanciera'), ('desarrollo'),
      ('devolucion_parcialidades'), ('devoluciones'), ('duenio'), ('lote'),
      ('pagos'), ('status'), ('tipodesarrollo'), ('traspasos'), ('venta'),
      ('venta_designado')
    ) AS t(tabla)
  LOOP
    -- venta_designado comes with Panteones and doesn't exist everywhere yet.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target.tabla AND policyname = target.tabla || '_panel_all'
    );
    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
      target.tabla || '_panel_all', target.tabla, internal, internal);
  END LOOP;
END $$;

ALTER POLICY user_roles_select_own_or_panel ON public.user_roles
  USING (
    user_id = auth.uid()
    OR public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'])
  );

-- Signed contracts and client documents: internal staff only.
ALTER POLICY private_files_select_panel ON storage.objects
  USING (
    bucket_id IN ('documentos-clientes', 'contratos-firmados')
    AND public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'])
  );
ALTER POLICY private_files_insert_panel ON storage.objects
  WITH CHECK (
    bucket_id IN ('documentos-clientes', 'contratos-firmados')
    AND public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'])
  );
ALTER POLICY private_files_delete_panel ON storage.objects
  USING (
    bucket_id IN ('documentos-clientes', 'contratos-firmados')
    AND public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri'])
  );

-- ── Sales: their own ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS vendedor_externo_read_own_ventas ON public.venta;
DROP POLICY IF EXISTS vendedor_externo_insert_own_ventas ON public.venta;

CREATE POLICY venta_vendedor_externo_own ON public.venta
  FOR ALL TO authenticated
  USING ((SELECT public.is_vendedor_externo()) AND vendedor_user_id = (SELECT auth.uid())::text)
  WITH CHECK ((SELECT public.is_vendedor_externo()) AND vendedor_user_id = (SELECT auth.uid())::text);

-- Sales are cancelled, never deleted.
CREATE POLICY venta_vendedor_externo_no_delete ON public.venta
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (SELECT public.is_vendedor_externo()));

-- ── Clients: the ones they registered and the ones on their sales ───────
-- The app reads a new client's id back before the sale exists, so each
-- client records who created it.
ALTER TABLE public.cliente ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS vendedor_externo_read_clientes ON public.cliente;
DROP POLICY IF EXISTS vendedor_externo_insert_clientes ON public.cliente;

CREATE POLICY cliente_vendedor_externo_own ON public.cliente
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_vendedor_externo())
    AND (
      created_by = (SELECT auth.uid())
      OR clienteid IN (SELECT public.clientes_de_mis_ventas())
    )
  )
  WITH CHECK (
    (SELECT public.is_vendedor_externo())
    AND (
      created_by = (SELECT auth.uid())
      OR clienteid IN (SELECT public.clientes_de_mis_ventas())
    )
  );

CREATE POLICY cliente_vendedor_externo_no_delete ON public.cliente
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (SELECT public.is_vendedor_externo()));

-- ── Lots: reserve a free one or release one nobody else holds ───────────
DROP POLICY IF EXISTS vendedor_externo_read_lotes ON public.lote;  -- lote_select_authenticated covers it
DROP POLICY IF EXISTS vendedor_externo_update_lote_estatus ON public.lote;

CREATE POLICY lote_vendedor_externo_estatus ON public.lote
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_vendedor_externo())
    AND estatus IN ('D', 'A')
    AND NOT public.lote_apartado_por_otro(loteid)
  )
  WITH CHECK (
    (SELECT public.is_vendedor_externo())
    AND estatus IN ('D', 'A')
  );

-- RLS can't limit columns, so a trigger keeps external sellers to estatus.
CREATE OR REPLACE FUNCTION public.lote_vendedor_externo_solo_estatus()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_vendedor_externo()
     AND (to_jsonb(NEW) - 'estatus') IS DISTINCT FROM (to_jsonb(OLD) - 'estatus') THEN
    RAISE EXCEPTION 'Un vendedor externo solo puede cambiar el estatus del lote'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lote_vendedor_externo_solo_estatus() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lote_vendedor_externo_solo_estatus ON public.lote;
CREATE TRIGGER lote_vendedor_externo_solo_estatus
  BEFORE UPDATE ON public.lote
  FOR EACH ROW EXECUTE FUNCTION public.lote_vendedor_externo_solo_estatus();
