CREATE OR REPLACE FUNCTION public.get_admin_user_emails()
RETURNS TABLE (email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT DISTINCT lower(trim(u.email))
  FROM auth.users AS u
  INNER JOIN public.user_roles AS ur ON ur.user_id = u.id
  WHERE u.email IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_roles AS caller_role
      WHERE caller_role.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_emails() TO authenticated;
