-- When each payment was captured in the system, apart from fechapago (the date
-- staff type in, which for advance payments is often the installment's due date).
-- Existing payments stay NULL: their capture date can't be rebuilt.

ALTER TABLE public.pagos
ADD COLUMN IF NOT EXISTS registrado_en TIMESTAMPTZ;

-- The database sets it; nobody can type or change it.
CREATE OR REPLACE FUNCTION public.pagos_fijar_registrado_en()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.registrado_en := now();
  ELSE
    NEW.registrado_en := OLD.registrado_en;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pagos_fijar_registrado_en() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pagos_fijar_registrado_en ON public.pagos;
CREATE TRIGGER pagos_fijar_registrado_en
BEFORE INSERT OR UPDATE ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.pagos_fijar_registrado_en();
