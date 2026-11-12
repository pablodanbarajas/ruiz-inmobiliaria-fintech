-- Saldo a favor utilizado para cubrir mensualidades.
-- Se registra separado del dinero recibido.

ALTER TABLE public.pagos
ADD COLUMN IF NOT EXISTS saldo_favor_aplicado NUMERIC(12,2)
NOT NULL DEFAULT 0;

ALTER TABLE public.pagos
DROP CONSTRAINT IF EXISTS pagos_saldo_favor_aplicado_check;

ALTER TABLE public.pagos
ADD CONSTRAINT pagos_saldo_favor_aplicado_check
CHECK (saldo_favor_aplicado >= 0);