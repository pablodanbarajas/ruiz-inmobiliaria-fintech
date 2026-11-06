ALTER TABLE lote
  ADD COLUMN IF NOT EXISTS zona text,
  ADD COLUMN IF NOT EXISTS cantidad_disponible integer NOT NULL DEFAULT 1;

ALTER TABLE lote
  DROP CONSTRAINT IF EXISTS lote_cantidad_disponible_check;

ALTER TABLE lote
  ADD CONSTRAINT lote_cantidad_disponible_check
  CHECK (cantidad_disponible >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS lote_panteones_zona_producto_unique
  ON lote (desarrolloid, lower(trim(zona)), tipolote)
  WHERE zona IS NOT NULL
    AND tipolote IN ('Gaveta', 'Cripta', 'Nicho');
