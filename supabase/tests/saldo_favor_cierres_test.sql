-- Tests for 20261112150000_saldo_favor_cierres.sql. Run against Ruiz_Test as
-- postgres (SQL Editor or execute_sql). Everything runs in one transaction that
-- always ends in an error: "RESULTADOS N de M ok: [...]" with one entry per
-- check. The error rolls everything back, so no data is left behind.
--
-- Roles are impersonated through the JWT (app_metadata.role), which
-- has_admin_panel_role accepts, so the test doesn't depend on real users.

BEGIN;

CREATE TEMP TABLE resultados (prueba text PRIMARY KEY, ok boolean, detalle text) ON COMMIT DROP;
CREATE TEMP TABLE ctx (k text PRIMARY KEY, v text) ON COMMIT DROP;
GRANT ALL ON resultados TO authenticated;
GRANT SELECT ON ctx TO authenticated;

-- Act as an authenticated user with the given panel role.
CREATE FUNCTION pg_temp.como(p_rol text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', CASE p_rol WHEN 'admin' THEN '00000000-0000-4000-8000-0000000000a1' ELSE '00000000-0000-4000-8000-0000000000b2' END,
    'role', 'authenticated',
    'app_metadata', json_build_object('role', p_rol),
    'user_metadata', json_build_object('nombre', 'Prueba', 'apellido', 'Saldo')
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE FUNCTION pg_temp.ctx(p_k text) RETURNS integer LANGUAGE sql AS $$ SELECT v::integer FROM ctx WHERE k = p_k $$;

-- ── Setup (postgres) ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_venta integer; v_corrida integer; v_activa integer; v_sin integer; v_antes numeric; v_pago integer;
BEGIN
  -- An active sale with at least two installments: gets a 300 abono, then is cancelled.
  SELECT v.ventaid INTO v_venta FROM venta v
  WHERE v.estatus = 'A' AND (SELECT count(*) FROM corridafinanciera c WHERE c.ventaid = v.ventaid) >= 2
  ORDER BY v.ventaid LIMIT 1;
  SELECT min(corridafinancieraid) INTO v_corrida FROM corridafinanciera WHERE ventaid = v_venta;

  SELECT COALESCE(sum(GREATEST(COALESCE(p.servicios_extra, 0), 0))
                - sum(GREATEST(-COALESCE(p.servicios_extra, 0), 0))
                - sum(COALESCE(p.saldo_favor_aplicado, 0)), 0)
    INTO v_antes
  FROM pagos p JOIN corridafinanciera c ON c.corridafinancieraid = p.corridafinancieraid
  WHERE c.ventaid = v_venta AND p.estatus IS DISTINCT FROM 'C';

  INSERT INTO pagos (corridafinancieraid, fechapago, montopagado, servicios_extra, formapago, estatus, comentario)
  VALUES (v_corrida, now(), 0.01, 300, 1, 'P', 'prueba saldo a favor')
  RETURNING pagoid INTO v_pago;
  UPDATE venta SET estatus = 'C' WHERE ventaid = v_venta;

  -- Another active sale stays active.
  SELECT ventaid INTO v_activa FROM venta WHERE estatus = 'A' AND ventaid <> v_venta ORDER BY ventaid LIMIT 1;

  -- A sale with no payments at all (so no saldo), cancelled for the "sin saldo" check.
  SELECT v.ventaid INTO v_sin FROM venta v
  WHERE v.estatus = 'A' AND v.ventaid NOT IN (v_venta, v_activa)
    AND NOT EXISTS (SELECT 1 FROM corridafinanciera c JOIN pagos p ON p.corridafinancieraid = c.corridafinancieraid WHERE c.ventaid = v.ventaid)
  ORDER BY v.ventaid LIMIT 1;
  UPDATE venta SET estatus = 'C' WHERE ventaid = v_sin;

  INSERT INTO ctx VALUES ('venta', v_venta), ('corrida', v_corrida), ('activa', v_activa),
                         ('sin', v_sin), ('pago', v_pago), ('antes', round(v_antes)::integer);
END $$;

-- ── saldo_calculado ───────────────────────────────────────────────────────
INSERT INTO resultados
SELECT 'saldo_calculado', public.saldo_favor_venta(pg_temp.ctx('venta')) = pg_temp.ctx('antes') + 300,
       'saldo = ' || public.saldo_favor_venta(pg_temp.ctx('venta'));

-- ── sin_permiso ───────────────────────────────────────────────────────────
SELECT pg_temp.como('vendedor');
DO $$ BEGIN
  PERFORM public.cerrar_saldo_favor(pg_temp.ctx('venta'), 'retencion');
  INSERT INTO resultados VALUES ('sin_permiso', false, 'no falló');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('sin_permiso', SQLERRM LIKE 'No tienes permiso%', SQLERRM);
END $$;
SELECT set_config('role', 'none', true);

-- ── venta_activa / sin_saldo / decision_invalida ──────────────────────────
SELECT pg_temp.como('admin');
DO $$ BEGIN
  PERFORM public.cerrar_saldo_favor(pg_temp.ctx('activa'), 'retencion');
  INSERT INTO resultados VALUES ('venta_activa', false, 'no falló');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('venta_activa', SQLERRM LIKE 'La venta no está cancelada%', SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM public.cerrar_saldo_favor(pg_temp.ctx('sin'), 'retencion');
  INSERT INTO resultados VALUES ('sin_saldo', false, 'no falló');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('sin_saldo', SQLERRM LIKE 'La venta no tiene saldo a favor%', SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM public.cerrar_saldo_favor(pg_temp.ctx('venta'), 'otro');
  INSERT INTO resultados VALUES ('decision_invalida', false, 'no falló');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('decision_invalida', SQLERRM LIKE 'Decisión inválida%', SQLERRM);
END $$;

-- ── reembolso ─────────────────────────────────────────────────────────────
DO $$
DECLARE r record; v_ok boolean;
BEGIN
  SELECT * INTO r FROM public.cerrar_saldo_favor(pg_temp.ctx('venta'), 'reembolso', '  prueba  ');
  SELECT r.monto = pg_temp.ctx('antes') + 300
     AND EXISTS (SELECT 1 FROM devoluciones d WHERE d.devolucionid = r.devolucionid AND d.monto_total = r.monto
                   AND d.motivo = 'Reembolso de saldo a favor' AND d.estatus = 'P' AND d.ventaid = pg_temp.ctx('venta'))
     AND (SELECT count(*) FROM devolucion_parcialidades x WHERE x.devolucionid = r.devolucionid AND x.monto = r.monto) = 1
     AND (SELECT count(*) FROM devolucion_parcialidades x WHERE x.devolucionid = r.devolucionid) = 1
     AND EXISTS (SELECT 1 FROM saldo_favor_cierres s WHERE s.cierreid = r.cierreid AND s.decision = 'reembolso'
                   AND s.created_by_nombre = 'Prueba Saldo' AND s.nota = 'prueba'
                   AND s.created_by = '00000000-0000-4000-8000-0000000000a1')
    INTO v_ok;
  INSERT INTO resultados VALUES ('reembolso', v_ok, 'monto ' || r.monto || ', devolución ' || r.devolucionid);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('reembolso', false, SQLERRM);
END $$;

-- ── decidir_dos_veces ─────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM public.cerrar_saldo_favor(pg_temp.ctx('venta'), 'retencion');
  INSERT INTO resultados VALUES ('decidir_dos_veces', false, 'no falló');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('decidir_dos_veces', SQLERRM LIKE 'La venta ya tiene una decisión%', SQLERRM);
END $$;
SELECT set_config('role', 'none', true);

-- ── reactivada_sin_saldo: a decided sale reactivated by mistake must not
-- have its refunded saldo available again (postgres) ──────────────────────
UPDATE venta SET estatus = 'A' WHERE ventaid = pg_temp.ctx('venta');
INSERT INTO resultados
SELECT 'reactivada_sin_saldo', public.saldo_favor_venta(pg_temp.ctx('venta')) = 0,
       'saldo = ' || public.saldo_favor_venta(pg_temp.ctx('venta'));
UPDATE venta SET estatus = 'C' WHERE ventaid = pg_temp.ctx('venta');

-- ── rls_lectura (a reader role sees it; nobody inserts directly) ──────────
SELECT pg_temp.como('vendedor');
INSERT INTO resultados
SELECT 'rls_lectura', (SELECT count(*) FROM public.saldo_favor_cierres WHERE ventaid = pg_temp.ctx('venta')) = 1, 'lectura';
DO $$ BEGIN
  INSERT INTO public.saldo_favor_cierres (ventaid, monto, decision, created_by, created_by_nombre)
  VALUES (pg_temp.ctx('activa'), 1, 'retencion', '00000000-0000-4000-8000-0000000000b2', 'x');
  INSERT INTO resultados VALUES ('rls_sin_insert', false, 'insertó');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('rls_sin_insert', true, SQLERRM);
END $$;
SELECT set_config('role', 'none', true);

-- ── retencion (undo the refund as postgres, then retain) ─────────────────
DELETE FROM devolucion_parcialidades WHERE devolucionid IN (SELECT devolucionid FROM saldo_favor_cierres WHERE ventaid = pg_temp.ctx('venta'));
CREATE TEMP TABLE borrar ON COMMIT DROP AS SELECT devolucionid FROM saldo_favor_cierres WHERE ventaid = pg_temp.ctx('venta');
DELETE FROM saldo_favor_cierres WHERE ventaid = pg_temp.ctx('venta');
DELETE FROM devoluciones WHERE devolucionid IN (SELECT devolucionid FROM borrar);
SELECT pg_temp.como('cobranza_caja');
DO $$
DECLARE r record; v_devs integer;
BEGIN
  SELECT count(*) INTO v_devs FROM devoluciones WHERE ventaid = pg_temp.ctx('venta');
  SELECT * INTO r FROM public.cerrar_saldo_favor(pg_temp.ctx('venta'), 'retencion');
  INSERT INTO resultados VALUES ('retencion',
    r.devolucionid IS NULL
      AND (SELECT count(*) FROM devoluciones WHERE ventaid = pg_temp.ctx('venta')) = v_devs
      AND EXISTS (SELECT 1 FROM saldo_favor_cierres WHERE cierreid = r.cierreid AND decision = 'retencion' AND nota IS NULL),
    'cierre ' || r.cierreid);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('retencion', false, SQLERRM);
END $$;
SELECT set_config('role', 'none', true);

-- ── trigger on pagos (postgres) ───────────────────────────────────────────
DO $$ BEGIN
  INSERT INTO pagos (corridafinancieraid, fechapago, montopagado, saldo_favor_aplicado, formapago, estatus)
  VALUES (pg_temp.ctx('corrida'), now(), 0, 50, 1, 'P');
  INSERT INTO resultados VALUES ('trigger_bloquea_saldo_nuevo', false, 'insertó');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('trigger_bloquea_saldo_nuevo', SQLERRM LIKE 'No se puede usar saldo a favor de una venta cancelada%', SQLERRM);
END $$;
DO $$ BEGIN
  UPDATE pagos SET estatus = 'C' WHERE pagoid = pg_temp.ctx('pago');
  INSERT INTO resultados VALUES ('trigger_permite_cancelar_pago', true, 'ok');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO resultados VALUES ('trigger_permite_cancelar_pago', false, SQLERRM);
END $$;

-- Report by raising: the error carries the results and aborts the transaction,
-- so nothing persists whatever runner executes this file.
DO $$ BEGIN
  RAISE EXCEPTION 'RESULTADOS % de % ok: %',
    (SELECT count(*) FILTER (WHERE ok) FROM resultados), (SELECT count(*) FROM resultados),
    (SELECT json_agg(json_build_object('prueba', prueba, 'ok', ok, 'detalle', detalle) ORDER BY prueba) FROM resultados);
END $$;

ROLLBACK;
