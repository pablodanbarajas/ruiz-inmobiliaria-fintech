-- Phase 2 of the access fix.
--
-- "Permitir todo a usuarios autenticados" (USING true) let any signed-in user,
-- including portal clients who can register on their own, read and change
-- every client, sale, payment, schedule and lot. Postgres combines permissive
-- policies with OR, so that one policy cancelled the own-records policies that
-- already exist on these tables.
--
-- Admin panel staff keep the same full access they had. Portal clients keep
-- what the portal needs: their own records (existing *_select_own policies),
-- the public lot catalog, and the extra charges of their own lots.

-- Wrapped in SELECT so Postgres evaluates it once per query, not once per row.
-- has_admin_panel_role is SECURITY DEFINER and reads user_roles directly.

-- ── Business tables: staff only, plus the existing own-records policies ──
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.cliente;
CREATE POLICY cliente_panel_all ON public.cliente
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.venta;
CREATE POLICY venta_panel_all ON public.venta
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.pagos;
CREATE POLICY pagos_panel_all ON public.pagos
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.corridafinanciera;
CREATE POLICY corridafinanciera_panel_all ON public.corridafinanciera
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.cargos_extra;
CREATE POLICY cargos_extra_panel_all ON public.cargos_extra
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

-- The portal shows each client the extra charges of their own lots.
CREATE POLICY cargos_extra_select_own ON public.cargos_extra
  FOR SELECT TO authenticated
  USING (
    loteid IN (
      SELECT v.loteid
      FROM public.venta v
      JOIN public.cliente c ON c.clienteid = v.clienteid
      WHERE c.email::text = (SELECT auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.duenio;
CREATE POLICY duenio_panel_all ON public.duenio
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Authenticated users can manage traspasos" ON public.traspasos;
CREATE POLICY traspasos_panel_all ON public.traspasos
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

-- ── Catalog tables: anyone signed in reads, staff writes ─────────────────
-- Lots are already public to visitors (allow anon read), and public_developments
-- counts available lots with the caller's permissions, so signed-in clients
-- must keep seeing every lot.
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.lote;
CREATE POLICY lote_select_authenticated ON public.lote
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY lote_panel_all ON public.lote
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

-- desarrollo_select_all already lets signed-in users read developments.
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.desarrollo;
CREATE POLICY desarrollo_panel_all ON public.desarrollo
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.tipodesarrollo;
CREATE POLICY tipodesarrollo_select_authenticated ON public.tipodesarrollo
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY tipodesarrollo_panel_all ON public.tipodesarrollo
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.status;
CREATE POLICY status_select_authenticated ON public.status
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY status_panel_all ON public.status
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));
