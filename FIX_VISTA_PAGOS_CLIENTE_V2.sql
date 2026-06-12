-- ============================================================================
-- FIX: vista_pagos_cliente - cargo_extra solo en la primer corrida del lote
-- Problema: cargo_extra_amount se multiplicaba en cada corrida
-- Solución: Mostrar cargo_extra solo en la corrida con nopago más bajo (primero)
-- ============================================================================

DROP VIEW IF EXISTS vista_pagos_cliente CASCADE;

CREATE VIEW vista_pagos_cliente AS
SELECT auth.uid() AS user_id,
    c.clienteid,
    v.ventaid,
    l.loteid AS lot_id,
    COALESCE(l.clavelote, (concat('Mza-', l.manzana, '-Lote-', l.nolote))::character varying) AS lot_key,
    d.desarrolloid AS development_id,
    d.nombre AS development_name,
    cf.corridafinancieraid,
    cf.nopago,
    'Mensualidad'::text AS payment_type,
    cf.fecha AS due_date,
    cf.mensualidad AS scheduled_amount,
    CASE
        WHEN cf.nopago = (SELECT MIN(cf2.nopago) FROM corridafinanciera cf2 WHERE cf2.ventaid = cf.ventaid)
        THEN COALESCE(( SELECT sum(ce.monto) AS sum FROM cargos_extra ce WHERE (ce.loteid = l.loteid) AND ce.estatus != 'X'), (0)::numeric)
        ELSE (0)::numeric
    END AS cargo_extra_amount,
        CASE
            WHEN ((cf.fecha < CURRENT_DATE) AND (COALESCE(( SELECT count(*) AS count
               FROM pagos p
              WHERE ((p.corridafinancieraid = cf.corridafinancieraid) AND ((p.estatus)::text = ANY ((ARRAY['P'::character varying, 'R'::character varying])::text[])))), (0)::bigint) = 0)) THEN calcular_recargo(cf.fecha, v.dias_tolerancia)
            ELSE (0)::numeric
        END AS recargo_pendiente,
    v.dias_tolerancia,
    COALESCE(( SELECT sum(p.montopagado) AS sum
           FROM pagos p
          WHERE ((p.corridafinancieraid = cf.corridafinancieraid) AND ((p.estatus)::text = ANY ((ARRAY['P'::character varying, 'R'::character varying])::text[])))), (0)::numeric) AS paid_amount,
    ( SELECT max(p.fechapago) AS max
           FROM pagos p
          WHERE ((p.corridafinancieraid = cf.corridafinancieraid) AND ((p.estatus)::text = ANY ((ARRAY['P'::character varying, 'R'::character varying])::text[])))) AS last_paid_at,
    0 AS recargo_pagado,
    0 AS moratorio_pagado,
        CASE
            WHEN (COALESCE(( SELECT count(*) AS count
               FROM pagos p
              WHERE ((p.corridafinancieraid = cf.corridafinancieraid) AND ((p.estatus)::text = ANY ((ARRAY['P'::character varying, 'R'::character varying])::text[])))), (0)::bigint) > 0) THEN 'pagado'::text
            WHEN (cf.fecha < CURRENT_DATE) THEN 'atrasado'::text
            ELSE 'pendiente'::text
        END AS payment_status
   FROM ((((cliente c
     JOIN venta v ON ((v.clienteid = c.clienteid)))
     JOIN lote l ON ((l.loteid = v.loteid)))
     JOIN desarrollo d ON ((d.desarrolloid = l.desarrolloid)))
     JOIN corridafinanciera cf ON ((cf.ventaid = v.ventaid)))
  WHERE (((c.email)::text = (auth.jwt() ->> 'email'::text)) AND ((v.estatus)::text = ANY ((ARRAY['A'::character varying, 'V'::character varying])::text[])))
  ORDER BY cf.fecha DESC;

-- Verificar
SELECT COUNT(*) as registros_en_vista
FROM vista_pagos_cliente;
