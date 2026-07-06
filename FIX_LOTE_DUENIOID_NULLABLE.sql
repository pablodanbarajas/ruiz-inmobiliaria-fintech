-- FIX: duenioid en lote debe ser nullable
-- El campo "dueño" es opcional al crear un lote.
-- Ejecutar en Supabase SQL Editor (requiere rol postgres / service_role).

ALTER TABLE lote ALTER COLUMN duenioid DROP NOT NULL;
