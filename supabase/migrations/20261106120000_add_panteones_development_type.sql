INSERT INTO tipodesarrollo (descripcion)
SELECT 'Panteones'
WHERE NOT EXISTS (
  SELECT 1
  FROM tipodesarrollo
  WHERE lower(trim(descripcion)) = 'panteones'
);
