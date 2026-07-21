-- ============================================================
-- FIX: Auto-crear registro en 'cliente' cuando un usuario se
--      registra desde el portal y no existe un cliente previo
--      con ese email.
--
-- PROBLEMA: El trigger trg_link_on_user_insert solo vincula un
--           auth.user con un cliente EXISTENTE por email. Si el
--           usuario es completamente nuevo (no estaba en el CRM),
--           no se crea ningún registro en cliente y la función
--           create-reservation devuelve:
--           "No se encontró un cliente asociado a este usuario."
--
-- SOLUCIÓN: Actualizar el trigger para que, si no encuentra un
--           cliente con ese email, cree uno nuevo usando los
--           metadatos del usuario (nombre y teléfono).
--
-- EJECUTAR EN: SQL Editor de Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_auth_user_to_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre    TEXT;
  v_telefono  TEXT;
  v_linked    INT;
BEGIN
  -- 1) Intentar vincular con cliente existente por email
  UPDATE public.cliente
  SET user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NULL;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- 2) Si no había cliente previo Y tampoco existe uno con ese email,
  --    crear uno nuevo (auto-registro del portal).
  --    Usamos NOT EXISTS en lugar de ON CONFLICT porque la columna email
  --    no tiene restricción UNIQUE definida en la tabla.
  IF v_linked = 0 THEN
    v_nombre := TRIM(COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ));

    v_telefono := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
      ''
    );

    INSERT INTO public.cliente (nombre, email, telefonocelular, user_id)
    SELECT v_nombre, NEW.email, v_telefono, NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cliente
      WHERE LOWER(email) = LOWER(NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Re-crear los triggers para usar la función actualizada
-- (los triggers ya existen, solo se actualiza la función)
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

-- ─────────────────────────────────────────────────────────────
-- PASO ADICIONAL: Arreglar usuarios ya registrados sin cliente
-- Ejecuta esto UNA VEZ para sanear usuarios existentes en auth
-- que no tienen cliente asociado.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  v_nombre   TEXT;
  v_telefono TEXT;
BEGIN
  FOR r IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cliente c
      WHERE LOWER(c.email) = LOWER(au.email)
    )
      AND au.email IS NOT NULL
  LOOP
    v_nombre := TRIM(COALESCE(
      r.raw_user_meta_data->>'full_name',
      r.raw_user_meta_data->>'name',
      split_part(r.email, '@', 1)
    ));
    v_telefono := COALESCE(
      NULLIF(TRIM(r.raw_user_meta_data->>'phone'), ''),
      ''
    );

    INSERT INTO public.cliente (nombre, email, telefonocelular, user_id)
    VALUES (v_nombre, r.email, v_telefono, r.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
