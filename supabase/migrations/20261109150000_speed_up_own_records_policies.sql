-- Follow-up to 20261109140000_remove_open_access_from_business_tables.
--
-- With the open policy gone, Postgres now evaluates the own-records policies
-- for staff too. They called is_staff(), a SECURITY DEFINER function, once per
-- row: reading a page of payments as admin went from 180 ms to about 6 s,
-- close to the API's 8 s limit.
--
-- Staff access now comes from the *_panel_all policies, so these policies
-- only need the "own records" check. auth.jwt() is wrapped in SELECT so
-- Postgres evaluates it once per query.

DROP POLICY IF EXISTS cliente_select_own ON public.cliente;
CREATE POLICY cliente_select_own ON public.cliente
  FOR SELECT TO authenticated
  USING (email::text = (SELECT auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS venta_select_own ON public.venta;
CREATE POLICY venta_select_own ON public.venta
  FOR SELECT TO authenticated
  USING (
    clienteid IN (
      SELECT c.clienteid FROM public.cliente c
      WHERE c.email::text = (SELECT auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS corridafinanciera_select_own ON public.corridafinanciera;
CREATE POLICY corridafinanciera_select_own ON public.corridafinanciera
  FOR SELECT TO authenticated
  USING (
    ventaid IN (
      SELECT v.ventaid FROM public.venta v
      JOIN public.cliente c ON c.clienteid = v.clienteid
      WHERE c.email::text = (SELECT auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS pagos_select_own ON public.pagos;
CREATE POLICY pagos_select_own ON public.pagos
  FOR SELECT TO authenticated
  USING (
    corridafinancieraid IN (
      SELECT cf.corridafinancieraid FROM public.corridafinanciera cf
      JOIN public.venta v ON v.ventaid = cf.ventaid
      JOIN public.cliente c ON c.clienteid = v.clienteid
      WHERE c.email::text = (SELECT auth.jwt() ->> 'email')
    )
  );

-- lote_select_authenticated already lets every signed-in user read lots.
DROP POLICY IF EXISTS lote_select_cliente_owns ON public.lote;

-- convenios has no panel policy, so staff still read it through this one.
-- Wrapping is_staff() in SELECT evaluates it once per query instead of per row.
DROP POLICY IF EXISTS convenios_select_own ON public.convenios;
CREATE POLICY convenios_select_own ON public.convenios
  FOR SELECT
  USING (
    (SELECT public.is_staff())
    OR ventaid IN (
      SELECT v.ventaid FROM public.venta v
      JOIN public.cliente c ON c.clienteid = v.clienteid
      WHERE c.email::text = (SELECT auth.jwt() ->> 'email')
    )
  );
