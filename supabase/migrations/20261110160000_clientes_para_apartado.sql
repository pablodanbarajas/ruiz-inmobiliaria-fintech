-- The reservation form's "Usar cliente existente" list must show external
-- sellers every client, so they link a returning client instead of creating
-- a duplicate. RLS limits them to their own clients and can't hide columns,
-- so the list comes from this function instead:
--   - internal staff get every client with phone and RFC, as before;
--   - external sellers get every client's name, and phone and RFC only for
--     their own clients (registered by them or on their sales);
--   - anyone else gets nothing.
-- Paged by clienteid because the API returns at most 1000 rows per call.

CREATE OR REPLACE FUNCTION public.clientes_para_apartado(p_after integer DEFAULT 0, p_limit integer DEFAULT 1000)
 RETURNS TABLE (clienteid integer, nombre text, telefonocelular text, rfc text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH quien AS (
    SELECT
      COALESCE(public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'contratos', 'cobranza_caja', 'desarrollo_ri']), false) AS interno,
      public.is_vendedor_externo() AS externo
  ),
  propios AS (
    SELECT public.clientes_de_mis_ventas() AS clienteid
  )
  SELECT
    c.clienteid,
    c.nombre::text,
    CASE WHEN q.interno OR c.created_by = auth.uid() OR c.clienteid IN (SELECT p.clienteid FROM propios p)
      THEN c.telefonocelular::text END,
    CASE WHEN q.interno OR c.created_by = auth.uid() OR c.clienteid IN (SELECT p.clienteid FROM propios p)
      THEN c.rfc::text END
  FROM public.cliente c, quien q
  WHERE (q.interno OR q.externo)
    AND c.clienteid > COALESCE(p_after, 0)
  ORDER BY c.clienteid
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 1000)
$$;

REVOKE EXECUTE ON FUNCTION public.clientes_para_apartado(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clientes_para_apartado(integer, integer) TO authenticated;
