-- ============================================================================
-- VISTA UNIFICADA: client_payment_summary
-- Calcula EXACTAMENTE como lo hace el admin - sincronización garantizada
-- ============================================================================

DROP VIEW IF EXISTS client_payment_summary CASCADE;

CREATE VIEW client_payment_summary AS
WITH client_saldos AS (
  SELECT 
    c.clienteid,
    c.email,
    v.ventaid,
    l.loteid,
    COALESCE(v.preciolote, 0) as precio_lote,
    COALESCE((
      SELECT SUM(p.montopagado)
      FROM pagos p
      JOIN corridafinanciera cf ON p.corridafinancieraid = cf.corridafinancieraid
      WHERE cf.ventaid = v.ventaid AND p.estatus NOT IN ('C')
    ), 0) as total_pagado
  FROM cliente c
  JOIN venta v ON v.clienteid = c.clienteid
  JOIN lote l ON l.loteid = v.loteid
  WHERE c.email = auth.jwt() ->> 'email'
    AND v.estatus IN ('A', 'V')
)
SELECT 
  clienteid,
  email,
  auth.uid() as user_id,
  SUM(precio_lote) as precio_total,
  SUM(total_pagado) as total_pagado,
  SUM(precio_lote) - SUM(total_pagado) as saldo_pendiente,
  (SELECT COUNT(DISTINCT corridafinancieraid)
   FROM corridafinanciera
   WHERE ventaid IN (SELECT ventaid FROM client_saldos WHERE clienteid = cs.clienteid)
     AND nopago > 0) as pagos_pendientes
FROM client_saldos cs
GROUP BY clienteid, email;

-- Test
SELECT * FROM client_payment_summary;
