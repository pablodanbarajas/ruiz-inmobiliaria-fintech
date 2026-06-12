-- ============================================================================
-- FIX: Actualizar nopago a 0 para todas las corridas PAGADAS
-- Problema: nopago no se actualiza cuando se registra el pago
-- ============================================================================

-- Actualizar: poner nopago=0 para corridas PAGADAS
UPDATE corridafinanciera cf
SET nopago = 0
WHERE ventaid = 3181
  AND nopago > 0
  AND corridafinancieraid IN (
    SELECT p.corridafinancieraid
    FROM pagos p
    WHERE p.estatus IN ('P', 'R')
    GROUP BY p.corridafinancieraid
  );

-- Verificar que quedó bien
SELECT 
  cf.corridafinancieraid,
  cf.nopago,
  cf.fecha,
  cf.mensualidad,
  SUM(CASE WHEN p.estatus IN ('P', 'R') THEN p.montopagado ELSE 0 END) as total_pagado,
  CASE 
    WHEN SUM(CASE WHEN p.estatus IN ('P', 'R') THEN p.montopagado ELSE 0 END) >= cf.mensualidad THEN 'PAGADA'
    ELSE 'PENDIENTE'
  END as estado
FROM corridafinanciera cf
LEFT JOIN pagos p ON p.corridafinancieraid = cf.corridafinancieraid
WHERE cf.ventaid = 3181
GROUP BY cf.corridafinancieraid, cf.nopago, cf.fecha, cf.mensualidad
ORDER BY cf.nopago ASC
LIMIT 10;
