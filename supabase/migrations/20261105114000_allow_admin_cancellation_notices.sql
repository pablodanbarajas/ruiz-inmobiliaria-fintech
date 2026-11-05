-- Permite que el personal autorizado gestione avisos de cancelación.
-- La tabla ya existe en el proyecto; esta migración solo corrige sus políticas RLS.

ALTER TABLE public.avisos_cancelacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avisos_cancelacion_select_admin" ON public.avisos_cancelacion;
CREATE POLICY "avisos_cancelacion_select_admin"
  ON public.avisos_cancelacion
  FOR SELECT
  TO authenticated
  USING (
    public.has_admin_panel_role(ARRAY['admin', 'supervisor_cobranza', 'cobrador', 'finanzas'])
  );

DROP POLICY IF EXISTS "avisos_cancelacion_insert_admin" ON public.avisos_cancelacion;
CREATE POLICY "avisos_cancelacion_insert_admin"
  ON public.avisos_cancelacion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_panel_role(ARRAY['admin', 'supervisor_cobranza', 'cobrador', 'finanzas'])
  );
