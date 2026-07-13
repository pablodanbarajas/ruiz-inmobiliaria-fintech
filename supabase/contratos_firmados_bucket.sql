-- ============================================================
-- Bucket: contratos-firmados
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear el bucket (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos-firmados',
  'contratos-firmados',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas RLS: solo usuarios autenticados con rol admin/tesoreria/vendedor
-- SELECT (ver / descargar)
CREATE POLICY "contratos_firmados_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contratos-firmados'
    AND auth.role() = 'authenticated'
  );

-- INSERT (subir)
CREATE POLICY "contratos_firmados_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contratos-firmados'
    AND auth.role() = 'authenticated'
  );

-- DELETE (eliminar)
CREATE POLICY "contratos_firmados_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contratos-firmados'
    AND auth.role() = 'authenticated'
  );
