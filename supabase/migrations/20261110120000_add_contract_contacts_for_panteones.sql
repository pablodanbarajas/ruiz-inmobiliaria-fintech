-- Data the Valle de Flores contract (Carátula V7) asks for and the app didn't store:
-- three notification emails for the Titular (Cláusula Décima Sexta), and one
-- Titular Sustituto plus up to two Beneficiarios in priority order (Cláusula Décima).

ALTER TABLE public.cliente
  ADD COLUMN IF NOT EXISTS email2 varchar,
  ADD COLUMN IF NOT EXISTS email3 varchar;

-- Designations belong to a contract, not to the client: the same client can name
-- different people on each space they buy.
CREATE TABLE IF NOT EXISTS public.venta_designado (
  venta_designado_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ventaid integer NOT NULL REFERENCES public.venta (ventaid) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('sustituto', 'beneficiario')),
  orden smallint NOT NULL DEFAULT 1,
  nombre text NOT NULL,
  domicilio text,
  telefono text,
  email text,
  parentesco text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venta_designado_orden_check CHECK (
    (rol = 'sustituto' AND orden = 1) OR (rol = 'beneficiario' AND orden IN (1, 2))
  ),
  CONSTRAINT venta_designado_unico UNIQUE (ventaid, rol, orden)
);

ALTER TABLE public.venta_designado ENABLE ROW LEVEL SECURITY;

-- Same access as the rest of the sale data: admin panel staff only.
CREATE POLICY venta_designado_panel_all ON public.venta_designado
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])))
  WITH CHECK ((SELECT public.has_admin_panel_role(ARRAY['admin', 'finanzas', 'vendedor', 'vendedor_externo', 'contratos', 'cobranza_caja', 'desarrollo_ri'])));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venta_designado TO authenticated;
-- Default privileges give visitors access to new tables; they never need this one.
REVOKE ALL ON public.venta_designado FROM anon;
