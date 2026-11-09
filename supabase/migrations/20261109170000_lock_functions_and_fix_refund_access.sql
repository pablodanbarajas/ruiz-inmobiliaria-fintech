-- Phase 3 of the access fix.

-- ── Maintenance jobs: no public access ───────────────────────────────────
-- These cancel expired reservations and down payments. pg_cron runs them as
-- postgres and create-reservation calls expire_reservations with the service
-- role, so visitors and signed-in users don't need to call them through the API.
REVOKE EXECUTE ON FUNCTION public.expire_enganche() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_enganche() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO service_role;

-- Trigger and event trigger functions can't be called through the API anyway;
-- triggers keep firing without EXECUTE, which is only checked at CREATE TRIGGER.
REVOKE EXECUTE ON FUNCTION public.link_auth_user_to_cliente() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_portal_confirmed_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- is_staff, is_admin_role and has_admin_panel_role stay executable: policies
-- call them with the caller's privileges, and they only describe the caller.

-- ── Fixed search_path ────────────────────────────────────────────────────
-- Without it, a SECURITY DEFINER function resolves names through the caller's
-- search_path. Every table these functions use lives in public.
ALTER FUNCTION public.is_staff() SET search_path = public;
ALTER FUNCTION public.is_admin_role() SET search_path = public;
ALTER FUNCTION public.has_admin_panel_role(text[]) SET search_path = public;
ALTER FUNCTION public.sync_portal_confirmed_at() SET search_path = public;
ALTER FUNCTION public.calcular_recargo(date, integer) SET search_path = public;
ALTER FUNCTION public.check_max_convenios_per_year() SET search_path = public;
ALTER FUNCTION public.generar_contrato_html(integer, integer) SET search_path = public;

-- ── Refunds: panel staff can save them ───────────────────────────────────
-- The old policies required auth.jwt() ->> 'role' = 'admin', but that claim is
-- always 'authenticated', so nobody could save a refund. Cancelling a sale
-- with more than 20% paid failed to register its refund without any error
-- shown on screen.
DROP POLICY IF EXISTS "Admin full access devoluciones" ON public.devoluciones;
CREATE POLICY devoluciones_panel_all ON public.devoluciones
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

DROP POLICY IF EXISTS "Admin full access devolucion_parcialidades" ON public.devolucion_parcialidades;
CREATE POLICY devolucion_parcialidades_panel_all ON public.devolucion_parcialidades
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));
