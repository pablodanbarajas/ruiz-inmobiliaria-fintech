-- calcular_recargo had two problems:
--
-- 1. It was IMMUTABLE but reads CURRENT_DATE. Postgres may then fold a call
--    with constant arguments into the plan and reuse it on a later day, so the
--    surcharge stops growing. STABLE is the correct volatility.
--
-- 2. It still charged $150 per 6 days of delay. The admin panel, the client
--    portal and sync-quentli-invoices moved to 7 days in August 2026 (commit
--    6c2c52c, "$150 semanales" in the contract). The portal views
--    client_lots and vista_pagos_cliente, which create-payment-link,
--    create-quentli-invoice and verify-payment read, kept the 6-day amount.

CREATE OR REPLACE FUNCTION public.calcular_recargo(fecha_vencimiento date, dias_tolerancia integer DEFAULT 0)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  dias_atraso INT;
BEGIN
  dias_atraso := (CURRENT_DATE - fecha_vencimiento) - COALESCE(dias_tolerancia, 0);
  IF dias_atraso <= 0 THEN RETURN 0; END IF;
  RETURN CEIL(dias_atraso::NUMERIC / 7) * 150;
END;
$function$;
