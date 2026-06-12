-- ============================================================================
-- DIAGNÓSTICO: Revisar corridas financieras del Lote PRU-00-01-001
-- Ejecutar EN: SQL Editor del Portal Supabase
-- COPIA Y PEGA CADA QUERY POR SEPARADO (divide en 3 queries)
-- ============================================================================

-- ============================================================================
-- QUERY 1: Ver el lote y su ventaid
-- ============================================================================
SELECT 
  l.loteid,
  l.clavelote,
  v.ventaid,
  v.clienteid
FROM lote l
JOIN venta v ON l.loteid = v.loteid
WHERE l.clavelote = 'PRU-00-01-001';

-- ============================================================================
-- QUERY 2: Ver todas las corridas financieras con estado de pago
-- (Usa el ventaid de QUERY 1 - reemplaza AQUI_EL_VENTAID)
-- ============================================================================
SELECT 
  cf.corridafinancieraid,
  cf.ventaid,
  cf.nopago,
  cf.fecha,
  cf.mensualidad,
  COUNT(p.pagoid) as cantidad_pagos,
  SUM(CASE WHEN p.estatus IN ('P', 'R') THEN p.montopagado ELSE 0 END) as total_pagado_confirmado,
  SUM(p.montopagado) as total_pagado_todos,
  CASE 
    WHEN SUM(CASE WHEN p.estatus IN ('P', 'R') THEN p.montopagado ELSE 0 END) >= cf.mensualidad THEN 'PAGADA'
    ELSE 'PENDIENTE'
  END as estado_real
FROM corridafinanciera cf
LEFT JOIN pagos p ON p.corridafinancieraid = cf.corridafinancieraid
WHERE cf.ventaid = 3181
GROUP BY cf.corridafinancieraid, cf.ventaid, cf.nopago, cf.fecha, cf.mensualidad
ORDER BY cf.nopago ASC;
