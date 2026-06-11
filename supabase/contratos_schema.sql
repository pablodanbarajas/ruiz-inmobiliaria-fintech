-- ============================================================================
-- TABLAS PARA MÓDULO DE CONTRATOS
-- ============================================================================
-- Almacena plantillas de contratos y contratos generados
-- Permite auto-población de datos del cliente, lote y convenio
-- ============================================================================

-- ============================================================================
-- Tabla 1: contrato_template
-- Almacena plantillas de contratos (machotes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contrato_template (
  contrato_template_id SERIAL PRIMARY KEY,
  
  -- Identificación
  nombre TEXT NOT NULL, -- Ej: "Contrato Pueblos de la Barranca"
  descripcion TEXT,
  
  -- Relacionado a desarrollo y dueño
  desarrolloid INTEGER REFERENCES desarrollo(desarrolloid) ON DELETE SET NULL,
  duenioid INTEGER, -- Opcional, para contratos específicos de dueño
  
  -- Contenido HTML de la plantilla
  contenido_html TEXT NOT NULL, -- HTML con variables {{cliente}}, {{lote}}, etc
  
  -- Variables que la plantilla espera
  variables_json JSONB DEFAULT '{}', -- {"cliente": true, "lote": true, "beneficiario": true, ...}
  
  -- Control de versiones
  version INTEGER DEFAULT 1,
  es_activa BOOLEAN DEFAULT true,
  
  -- Metadata
  tipo_contrato TEXT DEFAULT 'venta', -- 'venta', 'enganche', 'convenio', etc
  notas TEXT,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Índices
  CONSTRAINT check_variables CHECK (variables_json IS NOT NULL),
  CONSTRAINT check_tipo CHECK (tipo_contrato IN ('venta', 'enganche', 'convenio', 'otro'))
);

-- Índices
CREATE INDEX idx_contrato_template_desarrolloid ON contrato_template(desarrolloid);
CREATE INDEX idx_contrato_template_es_activa ON contrato_template(es_activa);
CREATE INDEX idx_contrato_template_tipo ON contrato_template(tipo_contrato);

-- Comentarios
COMMENT ON TABLE contrato_template IS 'Plantillas de contratos (machotes) que se auto-completan con datos del cliente y lote.';
COMMENT ON COLUMN contrato_template.variables_json IS 'JSON con variables que la plantilla espera: {cliente: true, lote: true, beneficiario: true, etc}';

-- ============================================================================
-- Tabla 2: contrato_generado
-- Almacena contratos generados (instancias de las plantillas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contrato_generado (
  contrato_generado_id SERIAL PRIMARY KEY,
  
  -- Relaciones
  contrato_template_id INTEGER NOT NULL REFERENCES contrato_template(contrato_template_id) ON DELETE RESTRICT,
  ventaid INTEGER NOT NULL REFERENCES venta(ventaid) ON DELETE CASCADE,
  clienteid INTEGER REFERENCES cliente(clienteid) ON DELETE SET NULL,
  
  -- Contenido generado
  contenido_html TEXT NOT NULL, -- HTML final después de reemplazar variables
  contenido_pdf BYTEA, -- PDF generado (opcional, se guarda después)
  
  -- Metadata
  fecha_generacion TIMESTAMP DEFAULT NOW(),
  fecha_firma TIMESTAMP,
  estado TEXT DEFAULT 'draft', -- 'draft', 'generado', 'firmado', 'cancelado'
  
  -- Auditoría y control
  generado_por UUID REFERENCES auth.users(id),
  notas TEXT,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Índices
  CONSTRAINT check_estado CHECK (estado IN ('draft', 'generado', 'firmado', 'cancelado'))
);

-- Índices
CREATE INDEX idx_contrato_generado_ventaid ON contrato_generado(ventaid);
CREATE INDEX idx_contrato_generado_clienteid ON contrato_generado(clienteid);
CREATE INDEX idx_contrato_generado_template ON contrato_generado(contrato_template_id);
CREATE INDEX idx_contrato_generado_estado ON contrato_generado(estado);

-- Comentarios
COMMENT ON TABLE contrato_generado IS 'Contratos generados a partir de plantillas. Almacena contenido final y PDF generado.';
COMMENT ON COLUMN contrato_generado.estado IS 'Flujo: draft → generado → firmado → cancelado';

-- ============================================================================
-- TABLA 3: variables_disponibles (Referencia)
-- Documenta qué variables están disponibles para usar en plantillas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.variables_disponibles (
  variable_id SERIAL PRIMARY KEY,
  
  nombre_variable TEXT NOT NULL, -- Ej: {{cliente_nombre}}
  descripcion TEXT,
  tipo_dato TEXT, -- 'string', 'number', 'date', 'currency'
  tabla_origen TEXT, -- 'cliente', 'venta', 'lote', 'convenio', etc
  columna_origen TEXT, -- 'nombre', 'email', etc
  ejemplo TEXT,
  
  -- Categoría
  categoria TEXT, -- 'cliente', 'propiedad', 'financiero', 'convenio'
  
  UNIQUE(nombre_variable)
);

-- Insertar variables disponibles
INSERT INTO variables_disponibles (nombre_variable, descripcion, tipo_dato, tabla_origen, columna_origen, ejemplo, categoria)
VALUES
  ('{{cliente_nombre}}', 'Nombre completo del cliente', 'string', 'cliente', 'nombre', 'Juan Pérez García', 'cliente'),
  ('{{cliente_email}}', 'Email del cliente', 'string', 'cliente', 'email', 'juan@example.com', 'cliente'),
  ('{{cliente_telefono}}', 'Teléfono del cliente', 'string', 'cliente', 'telefonocelular', '5551234567', 'cliente'),
  ('{{cliente_curp}}', 'CURP del cliente', 'string', 'cliente', 'curp', 'PERG761215HDRRRL09', 'cliente'),
  ('{{cliente_rfc}}', 'RFC del cliente', 'string', 'cliente', 'rfc', 'PERG761215HL9', 'cliente'),
  ('{{cliente_domicilio}}', 'Domicilio de cobro', 'string', 'cliente', 'domiciliocobro', 'Calle Principal 123', 'cliente'),
  
  ('{{lote_clavelote}}', 'Clave del lote', 'string', 'lote', 'clavelote', 'PB-A-001', 'propiedad'),
  ('{{lote_manzana}}', 'Manzana del lote', 'string', 'lote', 'manzana', 'A', 'propiedad'),
  ('{{lote_numero}}', 'Número del lote', 'string', 'lote', 'nolote', '001', 'propiedad'),
  ('{{lote_superficie}}', 'Superficie en m²', 'number', 'lote', 'superficie', '250.50', 'propiedad'),
  ('{{lote_precio}}', 'Precio del lote', 'currency', 'lote', 'preciolote', '250000.00', 'propiedad'),
  
  ('{{venta_precio}}', 'Precio total de venta', 'currency', 'venta', 'preciolote', '250000.00', 'financiero'),
  ('{{venta_enganche}}', 'Monto de enganche', 'currency', 'venta', 'enganche', '50000.00', 'financiero'),
  ('{{venta_enganche_pct}}', 'Porcentaje enganche', 'number', 'venta', 'porcenganche', '20', 'financiero'),
  ('{{venta_mensualidad}}', 'Mensualidad', 'currency', 'venta', 'mensualidad', '2500.00', 'financiero'),
  ('{{venta_plazo}}', 'Plazo en meses', 'number', 'venta', 'plazo', '120', 'financiero'),
  ('{{venta_fecha_contrato}}', 'Fecha de firma de contrato', 'date', 'venta', 'fechacontrato', '11 de junio de 2026', 'financiero'),
  ('{{venta_fecha_enganche}}', 'Fecha de pago de enganche', 'date', 'venta', 'fechaenganche', '30 de junio de 2026', 'financiero'),
  ('{{venta_fecha_primera_mensualidad}}', 'Fecha primera mensualidad', 'date', 'venta', 'fechaprimeramensualidad', '15 de julio de 2026', 'financiero'),
  
  ('{{convenio_meses}}', 'Meses para pagar atraso', 'number', 'convenio', 'meses_convenio', '3', 'convenio'),
  ('{{convenio_monto_mensual}}', 'Monto mensual del convenio', 'currency', 'convenio', 'monto_convenio_mensual', '1000.00', 'convenio'),
  ('{{convenio_monto_total}}', 'Monto total del atraso', 'currency', 'convenio', 'deuda_total_convenio', '3000.00', 'convenio'),
  ('{{convenio_fecha_fin}}', 'Fecha estimada de fin', 'date', 'convenio', 'fecha_fin_estimada', '11 de septiembre de 2026', 'convenio'),
  
  ('{{desarrollo_nombre}}', 'Nombre del desarrollo', 'string', 'desarrollo', 'nombre', 'Pueblos de la Barranca', 'propiedad'),
  ('{{desarrollo_descripcion}}', 'Descripción del desarrollo', 'string', 'desarrollo', 'descripcion', 'Desarrollo de lotes residenciales', 'propiedad'),
  ('{{fecha_hoy}}', 'Fecha actual', 'date', 'sistema', 'current_date', '11 de junio de 2026', 'sistema'),
  ('{{fecha_firma}}', 'Fecha de firma del contrato', 'date', 'sistema', 'fecha_contrato', '11 de junio de 2026', 'sistema');

-- ============================================================================
-- FUNCIÓN: generar_contrato
-- Reemplaza variables en el HTML de la plantilla con datos reales
-- ============================================================================
DROP FUNCTION IF EXISTS generar_contrato_html(INTEGER, INTEGER);

CREATE FUNCTION generar_contrato_html(
  p_contrato_template_id INTEGER,
  p_ventaid INTEGER
)
RETURNS TEXT AS $$
DECLARE
  v_html TEXT;
  v_cliente RECORD;
  v_venta RECORD;
  v_lote RECORD;
  v_convenio RECORD;
  v_desarrollo RECORD;
  v_html_resultado TEXT;
BEGIN
  -- Obtener plantilla
  SELECT contenido_html INTO v_html
  FROM contrato_template
  WHERE contrato_template_id = p_contrato_template_id;
  
  IF v_html IS NULL THEN
    RAISE EXCEPTION 'Plantilla de contrato no encontrada: %', p_contrato_template_id;
  END IF;
  
  -- Obtener datos de venta
  SELECT * INTO v_venta
  FROM venta
  WHERE ventaid = p_ventaid;
  
  IF v_venta.ventaid IS NULL THEN
    RAISE EXCEPTION 'Venta no encontrada: %', p_ventaid;
  END IF;
  
  -- Obtener cliente
  SELECT * INTO v_cliente
  FROM cliente
  WHERE clienteid = v_venta.clienteid;
  
  -- Obtener lote
  SELECT * INTO v_lote
  FROM lote
  WHERE loteid = v_venta.loteid;
  
  -- Obtener desarrollo
  SELECT * INTO v_desarrollo
  FROM desarrollo
  WHERE desarrolloid = v_lote.desarrolloid;
  
  -- Obtener convenio si existe
  SELECT * INTO v_convenio
  FROM convenios
  WHERE ventaid = p_ventaid AND estatus = 'V'
  LIMIT 1;
  
  -- Comenzar con el HTML de la plantilla
  v_html_resultado := v_html;
  
  -- Reemplazar variables de cliente
  v_html_resultado := REPLACE(v_html_resultado, '{{cliente_nombre}}', COALESCE(v_cliente.nombre, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{cliente_email}}', COALESCE(v_cliente.email, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{cliente_telefono}}', COALESCE(v_cliente.telefonocelular, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{cliente_curp}}', COALESCE(v_cliente.curp, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{cliente_rfc}}', COALESCE(v_cliente.rfc, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{cliente_domicilio}}', COALESCE(v_cliente.domiciliocobro, ''));
  
  -- Reemplazar variables de lote
  v_html_resultado := REPLACE(v_html_resultado, '{{lote_clavelote}}', COALESCE(v_lote.clavelote, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{lote_manzana}}', COALESCE(v_lote.manzana, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{lote_numero}}', COALESCE(v_lote.nolote, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{lote_superficie}}', COALESCE(v_lote.superficie::TEXT, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{lote_precio}}', COALESCE(v_lote.preciolote::TEXT, ''));
  
  -- Reemplazar variables de venta
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_precio}}', COALESCE(v_venta.preciolote::TEXT, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_enganche}}', COALESCE(v_venta.enganche::TEXT, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_enganche_pct}}', COALESCE(v_venta.porcenganche::TEXT, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_mensualidad}}', COALESCE(v_venta.mensualidad::TEXT, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_plazo}}', COALESCE(v_venta.plazo::TEXT, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_fecha_contrato}}', COALESCE(TO_CHAR(v_venta.fechacontrato, 'DD "de" Month "de" YYYY'), ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_fecha_enganche}}', COALESCE(TO_CHAR(v_venta.fechaenganche, 'DD "de" Month "de" YYYY'), ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{venta_fecha_primera_mensualidad}}', COALESCE(TO_CHAR(v_venta.fechaprimeramensualidad, 'DD "de" Month "de" YYYY'), ''));
  
  -- Reemplazar variables de desarrollo
  v_html_resultado := REPLACE(v_html_resultado, '{{desarrollo_nombre}}', COALESCE(v_desarrollo.nombre, ''));
  v_html_resultado := REPLACE(v_html_resultado, '{{desarrollo_descripcion}}', COALESCE(v_desarrollo.descripcion, ''));
  
  -- Reemplazar variables de convenio (si existe)
  IF v_convenio.convenioid IS NOT NULL THEN
    v_html_resultado := REPLACE(v_html_resultado, '{{convenio_meses}}', COALESCE(v_convenio.meses_convenio::TEXT, ''));
    v_html_resultado := REPLACE(v_html_resultado, '{{convenio_monto_mensual}}', COALESCE(v_convenio.monto_convenio_mensual::TEXT, ''));
    v_html_resultado := REPLACE(v_html_resultado, '{{convenio_monto_total}}', COALESCE(v_convenio.deuda_total_convenio::TEXT, ''));
    v_html_resultado := REPLACE(v_html_resultado, '{{convenio_fecha_fin}}', COALESCE(TO_CHAR(v_convenio.fecha_fin_estimada, 'DD "de" Month "de" YYYY'), ''));
  END IF;
  
  -- Reemplazar variables de sistema
  v_html_resultado := REPLACE(v_html_resultado, '{{fecha_hoy}}', TO_CHAR(CURRENT_DATE, 'DD "de" Month "de" YYYY'));
  v_html_resultado := REPLACE(v_html_resultado, '{{fecha_firma}}', TO_CHAR(COALESCE(v_venta.fechacontrato, CURRENT_DATE), 'DD "de" Month "de" YYYY'));
  
  RETURN v_html_resultado;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comentarios
COMMENT ON FUNCTION generar_contrato_html IS 'Genera HTML de contrato reemplazando variables con datos reales del cliente, lote y venta.';

-- ============================================================================
-- TRIGGERS Y RLS
-- ============================================================================

-- RLS para tablas de contratos (solo admin puede ver/crear)
ALTER TABLE contrato_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_generado ENABLE ROW LEVEL SECURITY;
ALTER TABLE variables_disponibles ENABLE ROW LEVEL SECURITY;

-- Política: Solo admin puede ver/editar plantillas
DROP POLICY IF EXISTS "contrato_template_admin" ON contrato_template;
CREATE POLICY "contrato_template_admin" ON contrato_template
  FOR ALL
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
  ));

-- Política: Solo admin puede ver/crear contratos generados
DROP POLICY IF EXISTS "contrato_generado_admin" ON contrato_generado;
CREATE POLICY "contrato_generado_admin" ON contrato_generado
  FOR ALL
  USING (auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.raw_user_meta_data->>'role' = 'admin'
  ));

-- Política: Todos pueden ver variables disponibles (referencia)
DROP POLICY IF EXISTS "variables_disponibles_read" ON variables_disponibles;
CREATE POLICY "variables_disponibles_read" ON variables_disponibles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- ÍNDICES FINALES
-- ============================================================================
CREATE INDEX idx_variables_disponibles_categoria ON variables_disponibles(categoria);
CREATE INDEX idx_variables_disponibles_tabla ON variables_disponibles(tabla_origen);

-- ============================================================================
-- FIN DE CREACIÓN DE TABLAS DE CONTRATOS
-- ============================================================================
-- Generado: 2026-06-11
-- Estado: LISTO PARA USAR
-- Próximos pasos:
-- 1. Crear UI en Contratos.tsx
-- 2. Implementar generación de PDF
-- 3. Crear templates de ejemplo
-- ============================================================================
