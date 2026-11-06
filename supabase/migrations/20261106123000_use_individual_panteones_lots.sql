DROP INDEX IF EXISTS lote_panteones_zona_producto_unique;

UPDATE lote
SET cantidad_disponible = 1
WHERE tipolote IN ('Gaveta', 'Cripta', 'Nicho')
  AND cantidad_disponible IS NULL;
