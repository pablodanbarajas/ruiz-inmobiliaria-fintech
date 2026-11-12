-- One active payment per Quentli invoice.
--
-- Both quentli-webhook and verify-payment (the portal) can register the same
-- online payment, sometimes at the same moment. They check for an existing
-- payment first, but two requests can pass that check together. This index
-- makes the second insert fail instead of recording the payment twice. A
-- cancelled payment (estatus C) doesn't count, so it can be registered again.
CREATE UNIQUE INDEX IF NOT EXISTS pagos_referencia_quentli_invoice_unique
  ON public.pagos (referencia)
  WHERE referencia LIKE 'inv\_%' AND estatus IS DISTINCT FROM 'C';
