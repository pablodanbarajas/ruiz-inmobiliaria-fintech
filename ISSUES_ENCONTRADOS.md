# 🐛 ISSUES ESPECÍFICOS ENCONTRADOS

## Categoría: SEGURIDAD CRÍTICA 🔴

### Issue #1: Webhook Quentli sin validación de firma
**Severidad:** 🔴 CRÍTICO  
**Archivo:** `supabase/functions/quentli-webhook/index.ts`  
**Línea:** 25-50  
**Tipo:** Vulnerabilidad de seguridad

**Descripción:**
El endpoint de webhook acepta cualquier POST sin validar la firma HMAC de Quentli. Esto permite que alguien falsifique pagos enviando directamente al endpoint.

**Código Problemático:**
```typescript
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return
  
  let body: any
  try {
    body = await req.json()  // ❌ Acepta cualquier JSON
  } catch {
    return error...
  }
  
  const clienteid = parseInt(data?.customer?.username ?? '', 10)
  const montopagado = amountCentavos / 100
  
  // ❌ DIRECTAMENTE REGISTRA SIN VERIFICAR FIRMA
  await supabase.from('pagos').insert({
    montopagado,
    referencia: invoiceId,
    // ... más campos
  })
}
```

**Riesgo:**
- Falsificación de pagos
- Pérdidas financieras
- Difícil de auditar

**Solución:**
```typescript
// Agregar en la parte superior
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts'

const verifyQuentliSignature = async (
  body: string,
  signature: string,
  secret: string
): Promise<boolean> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  
  const expected = crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(signature.split('').map(c => c.charCodeAt(0))),
    new TextEncoder().encode(body)
  )
  
  return expected
}

// En el handler:
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return
  
  const signature = req.headers.get('X-Quentli-Signature')
  if (!signature) {
    return new Response({ error: 'Missing signature' }, { status: 401 })
  }
  
  const bodyText = await req.text()
  const isValid = await verifyQuentliSignature(
    bodyText,
    signature,
    Deno.env.get('QUENTLI_SECRET_KEY') ?? ''
  )
  
  if (!isValid) {
    return new Response({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const body = JSON.parse(bodyText)
  // ... procesar el pago
})
```

**Prioridad:** ⚠️ HACER PRIMERO - Afecta seguridad financiera

---

## Categoría: FUNCIONALIDAD CRÍTICA ❌

### Issue #2: Portal Cliente 100% Mock
**Severidad:** 🔴 CRÍTICO  
**Archivo:** `portalCliente/src/services/clientService.ts`  
**Línea:** Todas  
**Tipo:** Bloqueador de funcionalidad

**Descripción:**
El portal del cliente no está conectado a Supabase. Todas las funciones retornan datos hardcodeados.

**Código Problemático:**
```typescript
// clientService.ts
const MOCK_CLIENT_DATA = {
  id: 1,
  name: "Juan Pérez",
  email: "juan@example.com",
  lots: [
    { id: 1, name: "Lote 1", status: "Vendido", price: 250000 }
  ]
}

export const fetchClientData = async () => {
  // ❌ Siempre retorna lo mismo
  return MOCK_CLIENT_DATA
}

export const fetchClientPayments = async () => {
  // ❌ Mock hardcodeado
  return [...]
}
```

**Impacto:**
- Cliente no puede ver datos reales
- No puede realizar pagos reales
- Portal no funciona en producción

**Solución:** Conectar a Supabase real
```typescript
// clientService.ts - NUEVO
import { supabase } from '@/lib/supabaseClient'

export const fetchClientData = async (clientId: number) => {
  const { data, error } = await supabase
    .from('cliente')
    .select('clienteid, nombre, email, telefonocelular')
    .eq('clienteid', clientId)
    .single()
  
  if (error) throw error
  return data
}

export const fetchClientLots = async (clientId: number) => {
  const { data, error } = await supabase
    .from('venta')
    .select('ventaid, lote:lote(loteid, clavelote, manzana, nolote, preciolote, estatus)')
    .eq('clienteid', clientId)
  
  if (error) throw error
  return data
}

export const fetchClientPayments = async (ventaId: number) => {
  const { data, error } = await supabase
    .from('pagos')
    .select('pagoid, fechapago, montopagado, estatus')
    .eq('corridafinanciera.ventaid', ventaId)
    .order('fechapago', { ascending: false })
  
  if (error) throw error
  return data
}
```

**Prioridad:** 🔴 CRÍTICO - Bloquea funcionalidad principal

---

### Issue #3: Contratos automáticos NO implementados
**Severidad:** 🔴 CRÍTICO  
**Archivo:** No existe (falta crear)  
**Línea:** N/A  
**Tipo:** Funcionalidad faltante

**Descripción:**
La minuta acordó crear módulo de contratos con auto-población, pero no existe.

**Requisitos:**
- Machotes por desarrollo
- Machotes por dueño
- Auto-población de:
  - Nombre cliente
  - Datos lote
  - Beneficiario
  - Datos convenio si existe
- Generación de PDF/documento

**Necesario:**
1. Crear tabla `contrato_template`:
```sql
CREATE TABLE contrato_template (
  id SERIAL PRIMARY KEY,
  desarrolloid INTEGER REFERENCES desarrollo(desarrolloid),
  duenioid INTEGER,
  nombre_template TEXT,
  contenido_html TEXT,
  variables_template TEXT[], -- Array de {nombre_cliente}, {lote}, etc
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
)
```

2. Crear UI `src/pages/admin/Contratos.tsx`:
   - Listar templates
   - Crear/editar template
   - Generar contrato para una venta

3. Implementar generación de PDF (usar librería como `html2pdf` o `puppeteer`)

**Prioridad:** 🔴 CRÍTICO - Acordado pero no implementado

---

## Categoría: VALIDACIONES FALTANTES ⚠️

### Issue #4: Límite de 3 convenios/año no enforced en DB
**Severidad:** 🟠 ALTO  
**Archivo:** `src/components/forms/ConvenioForm.tsx`, `src/pages/admin/Convenios.tsx`  
**Línea:** 55 (ConvenioForm), límite no validado en DB  
**Tipo:** Validación incompleta

**Descripción:**
La minuta acordó máximo 3 convenios por año por venta. El código UI lo valida, pero no hay constraint en DB. Un admin que POST directamente a la API podría crear 4.

**Código Problemático:**
```typescript
// ConvenioForm.tsx - Línea 55
const LIMITE_ANUAL = 3

// Más adelante:
if (conveniosEsteAnio >= LIMITE_ANUAL) {
  setErrors({ convenio: 'Máximo 3 convenios por año' })
}
// ❌ Pero esto es solo en la UI, no en DB
```

**Solución - Agregar constraint en DB:**
```sql
-- En supabase_convenios_alta.sql o nueva migración
ALTER TABLE convenios ADD CONSTRAINT check_max_3_convenios_per_venta_per_year
CHECK (
  (
    SELECT COUNT(*)
    FROM convenios c2
    WHERE c2.ventaid = convenios.ventaid
    AND EXTRACT(YEAR FROM c2.fecha) = EXTRACT(YEAR FROM convenios.fecha)
  ) <= 3
)
```

**O mejor aún, usar trigger:**
```sql
CREATE OR REPLACE FUNCTION check_max_convenios_per_year()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM convenios
    WHERE ventaid = NEW.ventaid
    AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM NEW.fecha)
  ) > 3 THEN
    RAISE EXCEPTION 'Máximo 3 convenios por año por venta';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_max_convenios_per_year
BEFORE INSERT ON convenios
FOR EACH ROW
EXECUTE FUNCTION check_max_convenios_per_year();
```

**Prioridad:** 🟠 ALTO - Fácil de implementar, importante para negocio

---

### Issue #5: Convenios - UI no muestra nuevos campos
**Severidad:** 🟠 ALTO  
**Archivo:** `src/pages/admin/Convenios.tsx`  
**Línea:** ~165 (columnas del DataTable)  
**Tipo:** UI incompleta

**Descripción:**
Los nuevos campos agregados a DB en 20260608 no se muestran en la tabla de convenios. Usuarios no ven:
- Meses del convenio
- Monto mensual convenio
- Monto total mensual objetivo
- Fecha fin estimada

**Código Problemático:**
```typescript
// Convenios.tsx - Línea ~165
const columns = [
  { key: 'convenioid', label: 'ID', render: (r) => `#${r.convenioid}` },
  { key: 'fecha', label: 'Fecha', render: (r) => formatDate(r.fecha) },
  { key: 'venta?.cliente?.nombre', label: 'Cliente' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'estatus', label: 'Estado', render: (r) => getConvenioStatusLabel(r.estatus) },
  // ❌ FALTAN:
  // { key: 'meses_convenio', label: 'Meses', render: (r) => r.meses_convenio },
  // { key: 'monto_convenio_mensual', label: 'Mensual Convenio', render: (r) => formatCurrency(r.monto_convenio_mensual) },
  // { key: 'pago_total_mensual_objetivo', label: 'Total Mensual', render: (r) => formatCurrency(r.pago_total_mensual_objetivo) },
  // { key: 'fecha_fin_estimada', label: 'Fin Estimada', render: (r) => formatDate(r.fecha_fin_estimada) },
]
```

**Solución:**
Agregar columnas:
```typescript
const columns = [
  { key: 'convenioid', label: 'ID', render: (r) => `#${r.convenioid}` },
  { key: 'fecha', label: 'Fecha', render: (r) => formatDate(r.fecha) },
  { key: 'venta?.cliente?.nombre', label: 'Cliente' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'meses_convenio', label: 'Meses', render: (r) => `${r.meses_convenio} meses` },
  { key: 'monto_convenio_mensual', label: 'Mensual Convenio', render: (r) => formatCurrency(r.monto_convenio_mensual) },
  { key: 'pago_total_mensual_objetivo', label: 'Total Mensual', render: (r) => formatCurrency(r.pago_total_mensual_objetivo) },
  { key: 'fecha_fin_estimada', label: 'Fin Estimada', render: (r) => formatDate(r.fecha_fin_estimada) },
  { key: 'estatus', label: 'Estado', render: (r) => getConvenioStatusLabel(r.estatus) },
]
```

**Prioridad:** 🟠 ALTO - UI importante para usabilidad

---

## Categoría: VERIFICACIÓN PENDIENTE ⚠️

### Issue #6: RLS Policies no verificadas en live DB
**Severidad:** 🟠 ALTO  
**Archivo:** `supabase_portal_setup.sql`  
**Línea:** ~50+  
**Tipo:** Configuración de seguridad no verificada

**Descripción:**
Las políticas de RLS están documentadas en SQL, pero no se ha verificado que estén realmente aplicadas en la DB de producción.

**Código Problemático:**
```sql
-- supabase_portal_setup.sql - línea ~50
CREATE POLICY "clientes_select_own"
  ON cliente FOR SELECT
  USING (clienteid = current_user_id())

-- ❌ PROBLEMA: current_user_id() puede no estar configurada correctamente
-- ❌ Se documentó pero no se verificó que esté aplicada
```

**Verificación Necesaria:**
```sql
-- En Supabase console, ejecutar:

-- 1. Listar todas las políticas
SELECT * FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'cliente'

-- 2. Verificar si RLS está habilitado en tabla
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'cliente'

-- 3. Probar que funciona (con usuario cliente):
SELECT * FROM cliente  -- Debería solo ver su propio registro
```

**Acción:** 
1. Verificar en live DB que todas las políticas existan
2. Si no existen, aplicarlas
3. Testar con usuario cliente que NO puede ver datos de otros

**Prioridad:** 🟠 ALTO - Crítico para seguridad

---

## Categoría: ERRORES DE MANEJO ⚠️

### Issue #7: Sin notificaciones de error en UI
**Severidad:** 🟡 MEDIO  
**Archivos:** Múltiples (Pagos, Convenios, Clientes, etc.)  
**Tipo:** UX/Error handling

**Descripción:**
Cuando ocurre un error en la aplicación, solo se registra en console.error. El usuario no ve nada.

**Código Problemático:**
```typescript
// Pagos.tsx
const fetchPagos = async () => {
  try {
    const { data, error } = await supabase.from('pagos').select(...)
    if (error) throw error
    setPagos(data)
  } catch (err) {
    console.error('Error fetching pagos:', err)  // ❌ Usuario no ve nada
  }
}
```

**Impacto:**
- Usuario no sabe si hubo error
- Confusión sobre estado de datos
- Mala experiencia

**Solución:** Implementar toast notifications
```typescript
// Crear hook useToast
export const useToast = () => {
  const [toast, setToast] = useState<{type: string, message: string} | null>(null)
  
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }
  
  return { toast, showToast }
}

// Usar en componentes:
const { toast, showToast } = useToast()

const fetchPagos = async () => {
  try {
    const { data, error } = await supabase.from('pagos').select(...)
    if (error) throw error
    setPagos(data)
    showToast('success', 'Pagos cargados')
  } catch (err) {
    showToast('error', `Error: ${err.message}`)
  }
}
```

**Prioridad:** 🟡 MEDIO - Mejora UX importante

---

## Categoría: DEUDA TÉCNICA ⚠️

### Issue #8: 12 instancias de `as any` casting
**Severidad:** 🟡 MEDIO  
**Archivos:** Varios (ConvenioForm, Convenios, etc.)  
**Tipo:** Type safety

**Ejemplos:**
```typescript
// ConvenioForm.tsx - Línea 92
(Array.isArray(lote) ? lote[0] : lote as any)?.desarrolloid

// Convenios.tsx - Línea 48
const lote = c.venta?.lote as any
```

**Impacto:**
- Pérdida de type safety
- Errores difíciles de detectar en compile time
- Mantenimiento más difícil

**Solución:** Mejorar tipos de interfaces y eliminar `as any`

**Prioridad:** 🟡 MEDIO - Importante para calidad de código

---

### Issue #9: Servicios incompletos o duplicados
**Severidad:** 🟡 BAJO  
**Archivo:** `src/services/convenios.ts`, helpers  
**Tipo:** Code organization

**Descripción:**
Hay funciones reutilizables esparcidas en múltiples archivos, algunas duplicadas.

**Prioridad:** 🟡 BAJO - Refactoring a futuro

---

## Checklist de Acciones

### Antes de Producción (Semana 1):
- [ ] Issue #1: Implementar validación HMAC en webhook
- [ ] Issue #2: Conectar portal cliente a Supabase
- [ ] Issue #3: Crear módulo de contratos automáticos
- [ ] Issue #6: Verificar RLS en live DB
- [ ] Issue #4: Agregar constraint DB para límite 3 convenios

### Segunda Semana:
- [ ] Issue #5: Actualizar UI de Convenios con nuevos campos
- [ ] Issue #7: Implementar toast notifications
- [ ] Issue #8: Eliminar `as any` casts

### Mejoras a Futuro:
- [ ] Issue #9: Refactorizar servicios

---

**Total Issues Encontrados:** 9  
**Críticos:** 3  
**Altos:** 4  
**Medios:** 2
