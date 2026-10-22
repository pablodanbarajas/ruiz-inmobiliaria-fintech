-- Completa el seguimiento administrativo del acceso al portal.
-- Permite distinguir una cuenta Auth existente que todavía no está vinculada
-- y repararla sin aceptar un UUID enviado por el cliente.

CREATE OR REPLACE FUNCTION public.portal_auth_status_by_email(p_email text)
RETURNS TABLE (
  auth_user_id uuid,
  auth_email text,
  email_confirmed_at timestamptz,
  invited_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id, u.email, u.email_confirmed_at, u.invited_at
  FROM auth.users AS u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.user_roles AS ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'vendedor')
      )
    )
  ORDER BY u.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.portal_auth_status_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_auth_status_by_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_cliente_link_by_id(p_clienteid integer)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_auth_user_id uuid;
  v_matches integer;
BEGIN
  IF NOT (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'vendedor')
    )
  ) THEN
    RAISE EXCEPTION 'Sin permisos para reparar vínculos';
  END IF;

  SELECT lower(trim(email)), user_id
  INTO v_email, v_auth_user_id
  FROM public.cliente
  WHERE clienteid = p_clienteid
  FOR UPDATE;

  IF v_email IS NULL OR v_email = '' OR v_auth_user_id IS NOT NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*), MIN(id)
  INTO v_matches, v_auth_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email;

  IF v_matches <> 1 THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cliente
    WHERE user_id = v_auth_user_id
      AND clienteid <> p_clienteid
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.cliente
  SET user_id = v_auth_user_id,
      email = v_email
  WHERE clienteid = p_clienteid
    AND user_id IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_cliente_link_by_id(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_cliente_link_by_id(integer) TO authenticated;

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
  END AS email_issue,
  auth_by_email.auth_user_id,
  auth_by_email.auth_email,
  auth_by_email.email_confirmed_at AS auth_email_confirmed_at,
  auth_by_email.invited_at AS auth_invited_at,
  CASE
    WHEN c.user_id IS NOT NULL AND auth_by_email.email_confirmed_at IS NOT NULL
      THEN 'activo'
    WHEN c.user_id IS NOT NULL
      THEN 'invitacion_pendiente'
    WHEN auth_by_email.auth_user_id IS NOT NULL
      THEN 'cuenta_sin_vinculo'
    WHEN c.email IS NULL OR TRIM(c.email) = ''
      THEN 'sin_email'
    WHEN TRIM(c.email) NOT LIKE '%@%'
      THEN 'email_invalido'
    ELSE 'sin_cuenta'
  END AS portal_status
FROM public.cliente AS c
JOIN public.venta AS v
  ON v.clienteid = c.clienteid
 AND v.estatus IS DISTINCT FROM 'C'
JOIN public.lote AS l ON l.loteid = v.loteid
JOIN public.desarrollo AS d ON d.desarrolloid = l.desarrolloid
LEFT JOIN LATERAL public.portal_auth_status(c.user_id) AS au ON true
LEFT JOIN LATERAL public.portal_auth_status_by_email(c.email) AS auth_by_email ON true
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
  d.nombre,
  auth_by_email.auth_user_id,
  auth_by_email.auth_email,
  auth_by_email.email_confirmed_at,
  auth_by_email.invited_at;

ALTER VIEW public.portal_invite_candidates SET (security_invoker = true);
REVOKE ALL ON public.portal_invite_candidates FROM PUBLIC, anon;
GRANT SELECT ON public.portal_invite_candidates TO authenticated;

CREATE OR REPLACE FUNCTION public.link_auth_user_to_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(NEW.email));
  v_nombre text;
  v_telefono text;
  v_linked integer;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.cliente
  SET user_id = NEW.id,
      email = v_email
  WHERE lower(trim(email)) = v_email
    AND user_id IS NULL;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  IF v_linked = 0 THEN
    v_nombre := trim(COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(v_email, '@', 1)
    ));
    v_telefono := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), '');

    INSERT INTO public.cliente (nombre, email, telefonocelular, user_id, estatus)
    SELECT v_nombre, v_email, v_telefono, NEW.id, 'A'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.cliente
      WHERE lower(trim(email)) = v_email
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_on_user_insert ON auth.users;
CREATE TRIGGER trg_link_on_user_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_auth_user_to_cliente();

DROP TRIGGER IF EXISTS trg_link_on_invite_accept ON auth.users;
CREATE TRIGGER trg_link_on_invite_accept
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.link_auth_user_to_cliente();
