-- Migración: soporte de invoices de Quentli por corrida financiera
-- Ejecutar en Supabase SQL Editor (producción y staging)

-- 1. Columna para guardar el invoice ID de Quentli por corrida de pago
ALTER TABLE corridafinanciera
  ADD COLUMN IF NOT EXISTS quentli_invoice_id text;

-- 2. Índice para idempotencia: evitar crear un invoice duplicado
CREATE INDEX IF NOT EXISTS idx_corridafinanciera_quentli_invoice
  ON corridafinanciera (quentli_invoice_id)
  WHERE quentli_invoice_id IS NOT NULL;

-- 3. Columna para guardar el subscription ID del cliente en Quentli (si aún no existe)
--    Nota: la tabla venta ya debería tener quentli_customer_id y quentli_subscription_id
--    Este ALTER es defensivo por si se crearon instancias sin esa columna.
ALTER TABLE venta
  ADD COLUMN IF NOT EXISTS quentli_subscription_id text;
