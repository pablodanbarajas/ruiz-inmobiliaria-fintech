-- Corrige las vistas detectadas por Supabase Security Advisor.
-- Ejecutar primero en Ruiz_Test y validar el portal antes de promover a producción.

-- La vista solo puede ver las filas que permitan las políticas RLS de las tablas base.
ALTER VIEW public.public_developments SET (security_invoker = true);
ALTER VIEW public.client_lots SET (security_invoker = true);
ALTER VIEW public.vista_pagos_cliente SET (security_invoker = true);
ALTER VIEW public.client_payment_summary SET (security_invoker = true);

-- portal_invite_candidates necesita los estados de Auth para el panel administrativo.
-- Encapsulamos exclusivamente esa lectura; la vista permanece security_invoker.
CREATE OR REPLACE FUNCTION public.portal_auth_status(p_user_id uuid)
RETURNS TABLE (
  email_confirmed_at timestamptz,
  invited_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.email_confirmed_at, u.invited_at
  FROM auth.users AS u
  WHERE u.id = p_user_id
    AND (
      p_user_id = auth.uid()
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.portal_auth_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_auth_status(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.portal_invite_candidates AS
SELECT
  c.clienteid,
  c.nombre,
  c.email,
  c.telefonocelular,
  c.user_id,
  au.invited_at AS invited_at,
  au.email_confirmed_at AS email_confirmed_at,
  d.desarrolloid AS development_id,
  d.nombre AS development_name,
  COUNT(DISTINCT l.loteid) AS num_lotes,
  (
    c.email IS NOT NULL
    AND LENGTH(TRIM(c.email)) > 3
    AND TRIM(c.email) LIKE '%@%'
  ) AS can_invite,
  CASE
    WHEN c.email IS NULL OR TRIM(c.email) = '' THEN 'Sin email'
    WHEN TRIM(c.email) NOT LIKE '%@%' THEN 'Email inválido'
    ELSE NULL
  END AS email_issue
FROM public.cliente AS c
JOIN public.venta AS v
  ON v.clienteid = c.clienteid
 AND v.estatus IS DISTINCT FROM 'C'
JOIN public.lote AS l ON l.loteid = v.loteid
JOIN public.desarrollo AS d ON d.desarrolloid = l.desarrolloid
LEFT JOIN LATERAL public.portal_auth_status(c.user_id) AS au ON true
WHERE c.email IS NOT NULL
  AND TRIM(c.email) <> ''
GROUP BY
  c.clienteid,
  c.nombre,
  c.email,
  c.telefonocelular,
  c.user_id,
  au.invited_at,
  au.email_confirmed_at,
  d.desarrolloid,
  d.nombre;

ALTER VIEW public.portal_invite_candidates SET (security_invoker = true);
REVOKE ALL ON public.portal_invite_candidates FROM PUBLIC, anon;
GRANT SELECT ON public.portal_invite_candidates TO authenticated;

REVOKE ALL ON public.public_developments FROM PUBLIC;
GRANT SELECT ON public.public_developments TO anon, authenticated;
REVOKE ALL ON public.client_lots FROM PUBLIC, anon;
GRANT SELECT ON public.client_lots TO authenticated;
REVOKE ALL ON public.vista_pagos_cliente FROM PUBLIC, anon;
GRANT SELECT ON public.vista_pagos_cliente TO authenticated;
REVOKE ALL ON public.client_payment_summary FROM PUBLIC, anon;
GRANT SELECT ON public.client_payment_summary TO authenticated;

-- Verificación: las cinco vistas deben devolver security_invoker = true.
SELECT
  n.nspname AS schemaname,
  c.relname AS viewname,
  COALESCE(
    c.reloptions @> ARRAY['security_invoker=true']::text[],
    false
  ) AS security_invoker
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN (
    'public_developments',
    'client_lots',
    'vista_pagos_cliente',
    'client_payment_summary',
    'portal_invite_candidates'
  )
ORDER BY viewname;
