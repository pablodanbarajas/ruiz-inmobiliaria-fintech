-- ============================================================================
-- INVESTIGACIÓN: De dónde viene la diferencia de $650
-- Admin: $457,600 | Portal: $458,250 | Diferencia: $650
-- ============================================================================

-- 1. Ver qué calcula la vista en total
SELECT 
  SUM(scheduled_amount) as total_mensualidades,
  SUM(cargo_extra_amount) as total_cargos_extra,
  SUM(recargo_pendiente) as total_recargos,
  (SUM(scheduled_amount) + SUM(cargo_extra_amount) + SUM(recargo_pendiente)) as total_vista
FROM vista_pagos_cliente
WHERE payment_status IN ('pendiente', 'atrasado');

-- 2. Ver desglose por lote
SELECT 
  lot_key,
  SUM(scheduled_amount) as mensualidades,
  SUM(cargo_extra_amount) as cargos_extra,
  SUM(recargo_pendiente) as recargos,
  COUNT(*) as cantidad_corridas
FROM vista_pagos_cliente
WHERE payment_status IN ('pendiente', 'atrasado')
GROUP BY lot_key
ORDER BY lot_key;

-- 3. Verificar si hay recargos en cargos_extra
SELECT 
  lot_key,
  corridafinancieraid,
  due_date,
  scheduled_amount,
  cargo_extra_amount,
  recargo_pendiente,
  (scheduled_amount + cargo_extra_amount + recargo_pendiente) as total_pago
FROM vista_pagos_cliente
WHERE payment_status IN ('pendiente', 'atrasado')
  AND (cargo_extra_amount > 0 OR recargo_pendiente > 0)
ORDER BY lot_key, due_date;
