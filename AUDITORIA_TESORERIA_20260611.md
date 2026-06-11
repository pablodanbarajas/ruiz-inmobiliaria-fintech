# AUDITORÍA: Sección Tesorería - 2026-06-11

## 1. RESUMEN EJECUTIVO
**Estado:** ⚠️ PARCIALMENTE FUNCIONAL con ERRORES CRÍTICOS en lógica
**Score:** 6/10
- ✅ Interfaz completa y bien estructurada
- ✅ Filtros funcionales
- ✅ Reportes/Exportación CSV
- ❌ **CRÍTICO:** Cálculo incorrecto de "Monto Aplicado"
- ❌ **CRÍTICO:** `getPagoAplicado()` usa lógica incorrecta
- ⚠️ Falta de validaciones de negocio
- ⚠️ Performance issues con muchos registros
- ⚠️ Falta de resumen/KPIs

---

## 2. COMPONENTES IMPLEMENTADOS

### 2.1 Interfaz Principal (Pagos.tsx)
**Archivo:** `src/pages/admin/Pagos.tsx`

#### Estructura Visual ✅
- Encabezado con título "Tesoreria" y descripción
- Panel de filtros: Cliente, Desarrollo, Fecha, Forma de pago
- 6 botones de exportación CSV
- Botón "Nuevo Pago"

#### Filtros ✅
```
✅ Cliente (SearchCombobox con nombre/teléfono)
✅ Desarrollo (select)
✅ Fecha Desde/Hasta (date input)
✅ Forma de Pago (select FORMAS_PAGO)
✅ Persistencia con usePersistedFilters hook
```

#### Pestañas
❌ **NO EXISTEN PESTAÑAS** - Todo está en una sola página
- Debería tener: "Pagos Registrados" | "Pendientes por Cobrar" | "Reportes"

---

## 3. REPORTES/ANÁLISIS IMPLEMENTADOS

### 3.1 Tabla: Pendientes por Cobrar ✅
```
Columnas: Cliente | Desarrollo | Pendiente | Total Pendiente
- Agrupa por cliente
- Calcula monto pendiente
- Sorteable por pendiente (mayor a menor)
- Exportable a CSV
```

### 3.2 Tabla: Corte por Cuenta Bancaria ✅
```
Columnas: Cuenta/Banco | Pagos | Cobrado | Aplicado
- Agrupa por cuenta_bancaria_id
- Cuenta con relación: cuenta_bancaria.nombre, banco
- Sorteable por aplicado (mayor a menor)
- Exportable a CSV
```

### 3.3 Tabla: Corte por Cobrador ✅
```
Columnas: Cobrador | Pagos | Cobrado | Aplicado
- Agrupa por cobrador (field)
- Sorteable
- Exportable a CSV
```

### 3.4 Tabla: Conciliación Diaria ✅
```
Columnas: Fecha | Pagos | Cobrado | Aplicado | Ajustes
- Agrupa por fecha
- Muestra diferencia entre cobrado y aplicado
- Exportable a CSV
```

### 3.5 Tabla Principal: Pagos Registrados ✅
```
Columnas: Pago ID | Cliente | Lote | Cobrador | Monto | Fecha | Estado | Acciones
- Filtrable
- Sorteable
- Detalles en modal
```

---

## 4. 🔴 ERRORES CRÍTICOS ENCONTRADOS

### ERROR #1: Cálculo Incorrecto de "Monto Aplicado"
**Ubicación:** `src/pages/admin/Pagos.tsx:106-109` y `src/components/forms/PagoForm.tsx:100-103`

```typescript
// ❌ INCORRECTO
const getPagoAplicado = (pago: Pago) => {
  const monto = pago.montopagado || 0
  const aplicadoDeSaldo = Math.max(0, -(pago.servicios_extra || 0))
  return monto + aplicadoDeSaldo
}
```

**Problema:**
- Según el formulario: servicios_extra puede ser + (crédito) o - (aplicar saldo)
- La fórmula actual IGNORA valores negativos de servicios_extra
- Si servicios_extra = -100 (aplicar saldo), el resultado es: monto + 0 = monto ❌

**Ejemplo Práctico:**
```
Escenario: Pago con descuento
- montopagado = 5000
- servicios_extra = -500 (se aplica un saldo a favor)

Resultado actual: getPagoAplicado() = 5000 + 0 = 5000 ❌
Resultado esperado: 5000 - 500 = 4500 ✅

Consecuencia: Los reportes de Tesorería muestran números incorrectos
```

### ERROR #2: Inconsistencia en Lógica de Negocio
**Ubicación:** PagoForm.tsx:452-455

```typescript
// El formulario dice:
// "Usa positivo para acumular saldo a favor y negativo para aplicarlo"

// Pero getPagoAplicado() hace:
return monto + Math.max(0, -servicios_extra)
// ^ Esto NO es lo opuesto correcto
```

---

## 5. ⚠️ PROBLEMAS DE DISEÑO

### Problema #1: Falta de Pestañas de Contexto
Toda la página es plana. Debería haber pestañas para organizar:
- **Tab 1: Pagos Registrados** (tabla principal)
- **Tab 2: Pendientes** (deudores sin pagar)
- **Tab 3: Reportes** (análisis: Corte Cobrador, Conciliación, Cuentas)

### Problema #2: Falta de Resumen/KPIs
Debería mostrar en el encabezado:
```
┌─────────────────────────────────────────┐
│ Total Cobrado: $X,XXX  |  Total Aplicado: $X,XXX  |  Diferencia: $X  │
│ Pagos Registrados: XXX  |  Pendientes: XXX  |  Por Cobrar: $X,XXX │
└─────────────────────────────────────────┘
```

### Problema #3: Botones Exportación Desordenados
6 botones de exportación en una fila:
```
[Exportar Pagos CSV] [Exportar Pendientes CSV] [Exportar Corte Cobrador CSV]
[Exportar Conciliacion CSV] [Exportar por Cuentas CSV] [Nuevo Pago]
```

**Solución:** Agrupar en un dropdown o Menu

### Problema #4: Performance - Sin Paginación
Lee todos los pagos de la BD en una sola consulta:
```typescript
// Línea ~240
const { data: pagos } = await supabase
  .from('pagos')
  .select(...)  // Sin limit!
```

Si hay 10,000+ pagos, se descarga todo. Debería haber paginación o lazy loading.

### Problema #5: Falta de Contexto RLS
- ✅ Filtros operativos funcionan
- ❌ ¿Qué pasa si usuario no es admin?
- No hay verificación de permisos en la UI

---

## 6. ✅ LO QUE SÍ FUNCIONA

### Filtros y Búsqueda
- ✅ Cliente con combobox (búsqueda por nombre/teléfono)
- ✅ Desarrollo con select
- ✅ Rango de fechas
- ✅ Forma de pago
- ✅ Persistencia de filtros entre sesiones

### Exportación
- ✅ 6 reportes exportables a CSV
- ✅ Nombres de archivo con fechas
- ✅ Formato correcto (headers + data)

### Integración de Cuentas Bancarias
- ✅ Relación: pagos.cuenta_bancaria_id → cuentas_bancarias
- ✅ Mostrada en tabla de pagos
- ✅ Grouping en "Corte por Cuenta Bancaria"

### Relaciones Expandidas
- ✅ corridafinanciera + venta + cliente + lote + desarrollo
- ✅ Información anidada funciona (pickFirst helper)

---

## 7. 🔧 RECOMENDACIONES

### CRÍTICO (arreglar inmediatamente)
1. **FIX: Función getPagoAplicado()**
   ```typescript
   const getPagoAplicado = (pago: Pago) => {
     const monto = pago.montopagado || 0
     const extra = pago.servicios_extra || 0
     return monto + extra  // ✅ Correcto: suma algebraica
   }
   ```
   
   Ubicaciones a actualizar:
   - `src/pages/admin/Pagos.tsx:106`
   - `src/pages/admin/Pagos.tsx` (en líneas ~370, 396, 432)
   - `src/components/forms/PagoForm.tsx:100`
   - `src/pages/admin/VentaDetail.tsx:42`
   - `src/pages/admin/ReportesPagos.tsx:56`

2. **Revisar reportes después del fix**
   - Los números cambiarán, necesita validación manual
   - Ejecutar query manual en Supabase para comparar

### Alto (próxima iteración)
3. **Agregar Pestañas de Contexto**
   - Organizar visual por funcionalidad
   - Mejorar UX

4. **Agregar Resumen/KPIs**
   - Mostrar totales agregados
   - Indicadores de performance

5. **Agrupar Botones de Exportación**
   - Dropdown: "Exportar..."
   - O un panel separado

6. **Agregar Paginación**
   - Implementar limit/offset o cursor-based
   - Default: mostrar 50 pagos, cargar más al scroll

### Medio (mejoras UX)
7. **Validaciones adicionales:**
   - ¿Forma de pago "Transferencia" sin cuenta? → error
   - ¿Monto negativo? → error
   - ¿Fecha en futuro? → warning

8. **Opciones de vista:**
   - Modo "Resumen" (KPIs solamente)
   - Modo "Detalle" (tablas completas)

---

## 8. CONCLUSIÓN

**Estado Actual:** La sección Tesorería tiene:
- ✅ Interfaz completa y organizada
- ✅ Filtros funcionales
- ✅ Exportación CSV
- ❌ **BUG CRÍTICO** en cálculo de "Aplicado"
- ⚠️ UX podría mejorarse

**Acción Inmediata:** Corregir getPagoAplicado() y validar reportes con datos reales.

**Score Ajustado:** 6/10 → 9/10 después de fix
