# Módulo de Contratos - Guía de Implementación

## 📋 Contenido

Este módulo permite:
- ✅ Crear plantillas de contratos (machotes)
- ✅ Auto-poblar variables (cliente, lote, convenio, etc.)
- ✅ Generar contratos a partir de plantillas
- ✅ Gestionar versiones de plantillas
- ✅ Exportar a PDF (implementar con librería)

---

## 🗂️ Archivos Creados

### Base de Datos
- `supabase/contratos_schema.sql` - Schema completo
  - Tabla `contrato_template` - Plantillas de contratos
  - Tabla `contrato_generado` - Contratos generados
  - Tabla `variables_disponibles` - Referencia de variables
  - Función PL/pgSQL `generar_contrato_html()` - Auto-población

### Código TypeScript
- `src/types/contrato.types.ts` - Tipos e interfaces
- `src/services/contratos.ts` - Servicio de API

### Pendiente de Crear
- `src/pages/admin/Contratos.tsx` - Página principal
- `src/components/forms/ContratoTemplateForm.tsx` - Formulario de plantilla
- `src/components/ContratoViewer.tsx` - Visor de contrato
- Tests unitarios

---

## 🚀 PASOS DE IMPLEMENTACIÓN

### Paso 1: Aplicar Schema SQL

1. Abre **Supabase Console** → **SQL Editor**
2. Copia contenido de `supabase/contratos_schema.sql`
3. Pega y ejecuta (Click **Run**)
4. Verifica que se creen 3 tablas sin errores

**Esperado:**
- ✅ Tabla `contrato_template` creada
- ✅ Tabla `contrato_generado` creada
- ✅ Tabla `variables_disponibles` creada + 25 variables insertadas
- ✅ Función `generar_contrato_html()` creada

### Paso 2: Crear Plantilla de Ejemplo

En **Supabase Console** → **SQL Editor**, ejecuta:

```sql
-- Insertar plantilla de ejemplo
INSERT INTO contrato_template (
  nombre,
  descripcion,
  desarrolloid,
  contenido_html,
  variables_json,
  tipo_contrato,
  notas
) VALUES (
  'Contrato Venta - Pueblos de la Barranca',
  'Contrato estándar de venta de lotes en Pueblos de la Barranca',
  11,  -- Pueblos de la Barranca
  '<html>
    <body>
      <h1>CONTRATO DE VENTA DE LOTE RESIDENCIAL</h1>
      <p>Celebrado en {{fecha_firma}}</p>
      <p><strong>VENDEDOR:</strong> {{desarrollo_nombre}}</p>
      <p><strong>COMPRADOR:</strong> {{cliente_nombre}}</p>
      <p><strong>CURP:</strong> {{cliente_curp}}</p>
      <p><strong>RFC:</strong> {{cliente_rfc}}</p>
      
      <h2>DATOS DEL LOTE</h2>
      <ul>
        <li>Clave: {{lote_clavelote}}</li>
        <li>Manzana: {{lote_manzana}}, Lote: {{lote_numero}}</li>
        <li>Superficie: {{lote_superficie}} m²</li>
        <li>Precio: {{lote_precio}}</li>
      </ul>
      
      <h2>TÉRMINOS FINANCIEROS</h2>
      <ul>
        <li>Precio Total: ${{venta_precio}}</li>
        <li>Enganche ({{venta_enganche_pct}}%): ${{venta_enganche}}</li>
        <li>Plazo: {{venta_plazo}} meses</li>
        <li>Mensualidad: ${{venta_mensualidad}}</li>
      </ul>
      
      <h2>FECHAS IMPORTANTES</h2>
      <ul>
        <li>Firma de Contrato: {{venta_fecha_contrato}}</li>
        <li>Pago de Enganche: {{venta_fecha_enganche}}</li>
        <li>Primera Mensualidad: {{venta_fecha_primera_mensualidad}}</li>
      </ul>
      
      <p>{{fecha_hoy}}</p>
    </body>
  </html>',
  '{
    "cliente_nombre": true,
    "cliente_curp": true,
    "cliente_rfc": true,
    "lote_clavelote": true,
    "lote_manzana": true,
    "lote_numero": true,
    "lote_superficie": true,
    "lote_precio": true,
    "venta_precio": true,
    "venta_enganche": true,
    "venta_enganche_pct": true,
    "venta_plazo": true,
    "venta_mensualidad": true,
    "desarrollo_nombre": true,
    "fecha_firma": true,
    "fecha_hoy": true
  }',
  'venta',
  'Plantilla básica de contrato de venta'
);
```

### Paso 3: Crear Página React `Contratos.tsx`

Estructura recomendada:

```typescript
// src/pages/admin/Contratos.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { contratoService } from '@/services/contratos'
import { ContratoTemplateForm } from '@/components/forms/ContratoTemplateForm'
import type { ContratoTemplate } from '@/types/contrato.types'
import { Plus, Edit2, Eye } from 'lucide-react'

export const Contratos = () => {
  const [templates, setTemplates] = useState<ContratoTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ContratoTemplate | null>(null)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await contratoService.obtenerTemplates()
        setTemplates(data)
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  const handleCreate = async (formData: any) => {
    try {
      await contratoService.crearTemplate(formData)
      setShowModal(false)
      // Recargar
      const data = await contratoService.obtenerTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Contratos</h1>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Nuevo Template
          </Button>
        </div>

        <DataTable
          columns={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'tipo_contrato', label: 'Tipo' },
            { key: 'version', label: 'Versión' },
            { key: 'es_activa', label: 'Activa', render: (r) => r.es_activa ? '✓' : '✗' },
            {
              key: 'acciones',
              label: 'Acciones',
              render: (row) => (
                <div className="flex gap-2">
                  <button className="text-blue-600"><Eye className="w-4 h-4" /></button>
                  <button className="text-green-600"><Edit2 className="w-4 h-4" /></button>
                </div>
              )
            }
          ]}
          rows={templates}
          loading={loading}
        />

        <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Template">
          <ContratoTemplateForm onSubmit={handleCreate} isLoading={false} />
        </Modal>
      </div>
    </AdminLayout>
  )
}
```

### Paso 4: Crear Formulario `ContratoTemplateForm.tsx`

Estructura recomendada:

```typescript
// src/components/forms/ContratoTemplateForm.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { contratoService } from '@/services/contratos'
import type { ContratoTemplateFormData } from '@/types/contrato.types'

interface ContratoTemplateFormProps {
  onSubmit: (data: ContratoTemplateFormData) => Promise<void>
  isLoading?: boolean
  initialValues?: Partial<ContratoTemplateFormData>
}

export const ContratoTemplateForm = ({
  onSubmit,
  isLoading = false,
  initialValues
}: ContratoTemplateFormProps) => {
  const [formData, setFormData] = useState<ContratoTemplateFormData>({
    nombre: initialValues?.nombre || '',
    descripcion: initialValues?.descripcion || '',
    desarrolloid: initialValues?.desarrolloid || null,
    contenido_html: initialValues?.contenido_html || '<html><body></body></html>',
    variables_json: initialValues?.variables_json || {},
    tipo_contrato: initialValues?.tipo_contrato || 'venta',
    notas: initialValues?.notas || ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones
    if (!formData.nombre.trim()) {
      setErrors({ nombre: 'El nombre es requerido' })
      return
    }
    
    if (!formData.contenido_html.includes('{{')) {
      setErrors({ contenido_html: 'El template debe incluir variables {{variable}}' })
      return
    }

    try {
      await onSubmit(formData)
    } catch (error: any) {
      setErrors({ submit: error.message })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre</label>
        <Input
          value={formData.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          placeholder="Ej: Contrato Venta - Pueblos"
          error={errors.nombre}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tipo</label>
        <select
          value={formData.tipo_contrato}
          onChange={(e) => handleChange('tipo_contrato', e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="venta">Venta</option>
          <option value="enganche">Enganche</option>
          <option value="convenio">Convenio</option>
          <option value="otro">Otro</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contenido HTML</label>
        <textarea
          value={formData.contenido_html}
          onChange={(e) => handleChange('contenido_html', e.target.value)}
          rows={15}
          className="w-full border rounded px-3 py-2 font-mono text-sm"
          placeholder="<html>...usa variables como {{cliente_nombre}}...</html>"
        />
        <p className="text-xs text-gray-500 mt-2">
          Variables disponibles: {{'{{'}}cliente_nombre{{'}}'}}, {{'{{'}}lote_clavelote{{'}}'}}, 
          {{'{{'}}venta_mensualidad{{'}}'}}, etc.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notas</label>
        <textarea
          value={formData.notas}
          onChange={(e) => handleChange('notas', e.target.value)}
          rows={3}
          className="w-full border rounded px-3 py-2"
          placeholder="Descripción o notas adicionales"
        />
      </div>

      {errors.submit && <p className="text-red-600 text-sm">{errors.submit}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary">Cancelar</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar Template'}
        </Button>
      </div>
    </form>
  )
}
```

### Paso 5: Integrar en Rutas

En `src/App.tsx` o `src/app/routes.tsx`, agregar:

```typescript
import { Contratos } from '@/pages/admin/Contratos'

// En rutas admin:
{
  path: 'contratos',
  Component: Contratos,
  meta: { requiredCapability: 'gestionar_contratos' }
}
```

### Paso 6: Agregar a Sidebar

En `src/components/layout/Sidebar.tsx`:

```typescript
{
  icon: FileText,
  label: 'Contratos',
  href: '/contratos',
  requiredCapability: 'gestionar_contratos'
}
```

---

## 📊 Variables Disponibles

30 variables ya configuradas en BD:

### Cliente
- `{{cliente_nombre}}` - Nombre completo
- `{{cliente_email}}` - Email
- `{{cliente_telefono}}` - Teléfono
- `{{cliente_curp}}` - CURP
- `{{cliente_rfc}}` - RFC
- `{{cliente_domicilio}}` - Domicilio

### Propiedad
- `{{lote_clavelote}}` - Clave del lote
- `{{lote_manzana}}` - Manzana
- `{{lote_numero}}` - Número
- `{{lote_superficie}}` - Superficie m²
- `{{lote_precio}}` - Precio

### Financiero
- `{{venta_precio}}` - Precio total
- `{{venta_enganche}}` - Monto enganche
- `{{venta_enganche_pct}}` - % enganche
- `{{venta_mensualidad}}` - Mensualidad
- `{{venta_plazo}}` - Plazo meses
- `{{venta_fecha_contrato}}` - Fecha firma
- `{{venta_fecha_enganche}}` - Fecha enganche
- `{{venta_fecha_primera_mensualidad}}` - Fecha 1er pago

### Convenio (si existe)
- `{{convenio_meses}}` - Meses para pagar
- `{{convenio_monto_mensual}}` - Monto mensual
- `{{convenio_monto_total}}` - Total atraso
- `{{convenio_fecha_fin}}` - Fecha fin estimada

### Sistema
- `{{fecha_hoy}}` - Fecha actual
- `{{fecha_firma}}` - Fecha firma

---

## 🎯 Próximos Pasos (Implementar Después)

1. **Generación de PDF**
   - Instalar librería: `npm install html2pdf` o `puppeteer`
   - Crear función para exportar contrato a PDF
   - Guardar PDF en storage

2. **Firma Digital**
   - Integrar servicio de firma (ej: DocuSign)
   - Marcar contrato como firmado

3. **Envío de Contratos**
   - Enviar por email al cliente
   - Notificación cuando cliente firma

4. **Versioning**
   - Mantener historial de plantillas
   - Comparar cambios entre versiones

---

## 🔐 Seguridad

- ✅ RLS habilitado: Solo admins ven/crean contratos
- ✅ Variables sanitizadas: No SQL injection
- ✅ HTML escapado: Previene XSS

---

## ❓ Troubleshooting

**Error: "relation \"contrato_template\" does not exist"**
- Las tablas no fueron creadas. Ejecuta `supabase/contratos_schema.sql`

**Variables no se reemplazan**
- Verificar que sintaxis es `{{variable_nombre}}` (minúsculas)
- Verificar que variable existe en `variables_disponibles`

**Contrato sale vacío**
- Email del usuario no coincide con cliente.email
- Verificar en SQL que existe el cliente

---

## 📝 SQL para Testing

```sql
-- Ver plantillas creadas
SELECT * FROM contrato_template ORDER BY created_at DESC;

-- Ver contratos generados
SELECT cg.*, ct.nombre as template_nombre 
FROM contrato_generado cg
INNER JOIN contrato_template ct ON cg.contrato_template_id = ct.contrato_template_id
ORDER BY cg.fecha_generacion DESC;

-- Ver variables disponibles
SELECT * FROM variables_disponibles ORDER BY categoria;

-- Generar un contrato de prueba
SELECT * FROM generar_contrato_html(1, 1);  -- template_id=1, venta_id=1
```

---

**Generado:** 2026-06-11  
**Criticidad:** 🔴 CRÍTICO - Funcionalidad acordada no implementada  
**Tiempo estimado:** 4-6 horas para completar (UI + PDF)
