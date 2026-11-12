-- Security phase 4: internal roles can only write what their screens allow.
--
-- Until now every internal role (admin, finanzas, vendedor, contratos,
-- cobranza_caja, desarrollo_ri) could insert, update and delete every business
-- table through the API, whatever the screens showed. Reads stay as they are;
-- writes now follow the role matrix (src/config/roles.ts) and the screens:
--
--   table                     insert / update                              delete
--   desarrollo                admin, desarrollo_ri                         admin, desarrollo_ri
--   duenio, status,
--   tipodesarrollo            admin                                        admin
--   lote                      insert: admin, desarrollo_ri                 admin, desarrollo_ri
--                             update: every internal role, but only admin
--                             and desarrollo_ri may change more than estatus
--   cliente                   admin, finanzas, contratos, desarrollo_ri    admin
--   venta                     admin, finanzas, contratos, cobranza_caja    admin; contratos and
--                                                                          cobranza_caja only a sale
--                                                                          with no schedule (rollback)
--   corridafinanciera         admin, contratos, cobranza_caja              admin
--   pagos                     admin, finanzas, cobranza_caja               admin
--   devoluciones,
--   devolucion_parcialidades  admin, finanzas, contratos, cobranza_caja    admin
--   traspasos                 insert: admin, contratos, cobranza_caja      admin
--                             update: admin
--   cargos_extra, convenios   admin                                        admin
--   contrato_generado,
--   contrato_template         admin, contratos                             admin, contratos
--
-- Edge functions use the secret key and SECURITY DEFINER functions run as their
-- owner, so neither is affected. Client (portal) and vendedor_externo policies
-- are left as they are.
--
-- Also adds auditoria_cambios: who created, changed or deleted each payment and
-- sale, when, and the row before and after. Nobody can edit it through the API.

-- ── 1. Drop the broad write policies ───────────────────────────────────────

DROP POLICY IF EXISTS cargos_extra_panel_all ON public.cargos_extra;
DROP POLICY IF EXISTS cargos_extra_write ON public.cargos_extra;
DROP POLICY IF EXISTS cargos_extra_insert ON public.cargos_extra;
DROP POLICY IF EXISTS cargos_extra_update ON public.cargos_extra;
DROP POLICY IF EXISTS cargos_extra_delete ON public.cargos_extra;
DROP POLICY IF EXISTS cliente_panel_all ON public.cliente;
DROP POLICY IF EXISTS cliente_insert_admin ON public.cliente;
DROP POLICY IF EXISTS cliente_update_admin ON public.cliente;
DROP POLICY IF EXISTS convenios_insert_admin ON public.convenios;
DROP POLICY IF EXISTS convenios_update_admin ON public.convenios;
DROP POLICY IF EXISTS corridafinanciera_panel_all ON public.corridafinanciera;
DROP POLICY IF EXISTS corridafinanciera_insert_admin ON public.corridafinanciera;
DROP POLICY IF EXISTS corridafinanciera_update_admin ON public.corridafinanciera;
DROP POLICY IF EXISTS desarrollo_panel_all ON public.desarrollo;
DROP POLICY IF EXISTS devolucion_parcialidades_panel_all ON public.devolucion_parcialidades;
DROP POLICY IF EXISTS devoluciones_panel_all ON public.devoluciones;
DROP POLICY IF EXISTS duenio_panel_all ON public.duenio;
DROP POLICY IF EXISTS lote_panel_all ON public.lote;
DROP POLICY IF EXISTS lote_update_admin ON public.lote;
DROP POLICY IF EXISTS pagos_panel_all ON public.pagos;
DROP POLICY IF EXISTS pagos_insert_cobradores ON public.pagos;
DROP POLICY IF EXISTS pagos_update_admin ON public.pagos;
DROP POLICY IF EXISTS status_panel_all ON public.status;
DROP POLICY IF EXISTS tipodesarrollo_panel_all ON public.tipodesarrollo;
DROP POLICY IF EXISTS traspasos_panel_all ON public.traspasos;
DROP POLICY IF EXISTS venta_panel_all ON public.venta;
DROP POLICY IF EXISTS venta_insert_admin ON public.venta;
DROP POLICY IF EXISTS venta_update_admin ON public.venta;
DROP POLICY IF EXISTS contrato_generado_admin ON public.contrato_generado;
DROP POLICY IF EXISTS contrato_template_admin ON public.contrato_template;

-- ── 2. Reads: every internal role keeps reading the business tables ────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cargos_extra', 'cliente', 'corridafinanciera', 'desarrollo', 'devolucion_parcialidades',
    'devoluciones', 'duenio', 'lote', 'pagos', 'status', 'tipodesarrollo', 'traspasos', 'venta'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_panel_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.has_admin_panel_role(%L::text[])))',
      t || '_panel_select', t,
      '{admin,finanzas,vendedor,contratos,cobranza_caja,desarrollo_ri}'
    );
  END LOOP;
END $$;

-- ── 3. Writes per table ─────────────────────────────────────────────────────
-- write_policies(table, insert roles, update roles, delete roles); NULL = nobody.

CREATE OR REPLACE FUNCTION pg_temp.write_policies(t text, ins text, upd text, del text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_panel_insert', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_panel_update', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_panel_delete', t);
  IF ins IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_admin_panel_role(%L::text[])))', t || '_panel_insert', t, ins);
  END IF;
  IF upd IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.has_admin_panel_role(%L::text[]))) WITH CHECK ((SELECT public.has_admin_panel_role(%L::text[])))', t || '_panel_update', t, upd, upd);
  END IF;
  IF del IS NOT NULL THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.has_admin_panel_role(%L::text[])))', t || '_panel_delete', t, del);
  END IF;
END $$;

SELECT pg_temp.write_policies('desarrollo', '{admin,desarrollo_ri}', '{admin,desarrollo_ri}', '{admin,desarrollo_ri}');
SELECT pg_temp.write_policies('duenio', '{admin}', '{admin}', '{admin}');
SELECT pg_temp.write_policies('status', '{admin}', '{admin}', '{admin}');
SELECT pg_temp.write_policies('tipodesarrollo', '{admin}', '{admin}', '{admin}');
SELECT pg_temp.write_policies('lote', '{admin,desarrollo_ri}', '{admin,finanzas,vendedor,contratos,cobranza_caja,desarrollo_ri}', '{admin,desarrollo_ri}');
SELECT pg_temp.write_policies('cliente', '{admin,finanzas,contratos,desarrollo_ri}', '{admin,finanzas,contratos,desarrollo_ri}', '{admin}');
SELECT pg_temp.write_policies('venta', '{admin,finanzas,contratos,cobranza_caja}', '{admin,finanzas,contratos,cobranza_caja}', '{admin}');
SELECT pg_temp.write_policies('corridafinanciera', '{admin,contratos,cobranza_caja}', '{admin,contratos,cobranza_caja}', '{admin}');
SELECT pg_temp.write_policies('pagos', '{admin,finanzas,cobranza_caja}', '{admin,finanzas,cobranza_caja}', '{admin}');
SELECT pg_temp.write_policies('devoluciones', '{admin,finanzas,contratos,cobranza_caja}', '{admin,finanzas,contratos,cobranza_caja}', '{admin}');
SELECT pg_temp.write_policies('devolucion_parcialidades', '{admin,finanzas,contratos,cobranza_caja}', '{admin,finanzas,contratos,cobranza_caja}', '{admin}');
SELECT pg_temp.write_policies('traspasos', '{admin,contratos,cobranza_caja}', '{admin}', '{admin}');
SELECT pg_temp.write_policies('cargos_extra', '{admin}', '{admin}', '{admin}');
SELECT pg_temp.write_policies('convenios', '{admin}', '{admin}', '{admin}');
SELECT pg_temp.write_policies('contrato_generado', '{admin,contratos}', '{admin,contratos}', '{admin,contratos}');
SELECT pg_temp.write_policies('contrato_template', '{admin,contratos}', '{admin,contratos}', '{admin,contratos}');

-- The contract screens also read these two tables.
DROP POLICY IF EXISTS contrato_generado_panel_select ON public.contrato_generado;
CREATE POLICY contrato_generado_panel_select ON public.contrato_generado
FOR SELECT TO authenticated USING ((SELECT public.has_admin_panel_role('{admin,contratos}'::text[])));
DROP POLICY IF EXISTS contrato_template_panel_select ON public.contrato_template;
CREATE POLICY contrato_template_panel_select ON public.contrato_template
FOR SELECT TO authenticated USING ((SELECT public.has_admin_panel_role('{admin,contratos}'::text[])));

-- Creating a sale removes it again if its schedule fails to save. Contratos and
-- Caja may only delete a sale in that state: no schedule rows yet. The check
-- runs as the owner: corridafinanciera's policies read venta, so querying it
-- from a venta policy would be an infinite policy recursion.
CREATE OR REPLACE FUNCTION public.venta_sin_corrida(p_ventaid INTEGER)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.corridafinanciera c WHERE c.ventaid = p_ventaid)
$$;

REVOKE ALL ON FUNCTION public.venta_sin_corrida(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venta_sin_corrida(INTEGER) TO authenticated;

DROP POLICY IF EXISTS venta_panel_delete_sin_corrida ON public.venta;
CREATE POLICY venta_panel_delete_sin_corrida ON public.venta
FOR DELETE TO authenticated
USING (
  (SELECT public.has_admin_panel_role('{contratos,cobranza_caja}'::text[]))
  AND public.venta_sin_corrida(ventaid)
);

-- ── 4. Lots: only admin and desarrollo_ri change more than the status ───────

CREATE OR REPLACE FUNCTION public.lote_solo_estatus_sin_permiso()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Server-side work (edge functions, cron, migrations) has no signed-in user.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'estatus') IS DISTINCT FROM (to_jsonb(OLD) - 'estatus')
     AND NOT COALESCE(public.has_admin_panel_role(ARRAY['admin', 'desarrollo_ri']), false) THEN
    RAISE EXCEPTION 'Tu rol solo puede cambiar el estatus del lote'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lote_solo_estatus_sin_permiso() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lote_solo_estatus_sin_permiso ON public.lote;
CREATE TRIGGER lote_solo_estatus_sin_permiso
BEFORE UPDATE ON public.lote
FOR EACH ROW EXECUTE FUNCTION public.lote_solo_estatus_sin_permiso();

-- ── 5. Change log for payments and sales ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auditoria_cambios (
  auditoriaid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id BIGINT,
  accion TEXT NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id UUID,
  usuario_email TEXT,
  usuario_roles TEXT,
  cambiado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  antes JSONB,
  despues JSONB
);

CREATE INDEX IF NOT EXISTS auditoria_cambios_registro_idx ON public.auditoria_cambios (tabla, registro_id);
CREATE INDEX IF NOT EXISTS auditoria_cambios_fecha_idx ON public.auditoria_cambios (cambiado_en DESC);

ALTER TABLE public.auditoria_cambios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_cambios FROM anon, authenticated;
GRANT SELECT ON public.auditoria_cambios TO authenticated;

DROP POLICY IF EXISTS auditoria_cambios_select ON public.auditoria_cambios;
CREATE POLICY auditoria_cambios_select ON public.auditoria_cambios
FOR SELECT TO authenticated USING ((SELECT public.has_admin_panel_role('{admin,finanzas}'::text[])));

-- tg_argv[0] is the table's id column.
CREATE OR REPLACE FUNCTION public.auditar_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_antes JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_despues JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND v_antes = v_despues THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.auditoria_cambios (tabla, registro_id, accion, usuario_id, usuario_email, usuario_roles, antes, despues)
  VALUES (
    TG_TABLE_NAME,
    (COALESCE(v_despues, v_antes) ->> TG_ARGV[0])::BIGINT,
    TG_OP,
    v_uid,
    auth.jwt() ->> 'email',
    (SELECT string_agg(ur.role::text, ',' ORDER BY ur.role::text) FROM public.user_roles ur WHERE ur.user_id = v_uid),
    v_antes,
    v_despues
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.auditar_cambio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auditar_pagos ON public.pagos;
CREATE TRIGGER auditar_pagos
AFTER INSERT OR UPDATE OR DELETE ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio('pagoid');

DROP TRIGGER IF EXISTS auditar_venta ON public.venta;
CREATE TRIGGER auditar_venta
AFTER INSERT OR UPDATE OR DELETE ON public.venta
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio('ventaid');
