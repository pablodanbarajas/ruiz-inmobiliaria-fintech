# Sistema de Toast Notifications

## 📋 Qué es

Sistema global de notificaciones para mostrar mensajes al usuario (errores, éxito, advertencias, info) sin bloquear la UI.

## 🎯 Usos Comunes

### Reemplazar `console.error()` por notificaciones visuales:

**ANTES (sin Toast):**
```typescript
const handleSubmit = async () => {
  try {
    await saveData()
  } catch (error) {
    console.error('Error:', error)  // ❌ Usuario no ve nada
  }
}
```

**DESPUÉS (con Toast):**
```typescript
import { useToastContext } from '@/context/ToastContext'

const handleSubmit = async () => {
  const { error } = useToastContext()
  try {
    await saveData()
  } catch (err: any) {
    error('Error al guardar', err.message)  // ✅ Usuario ve notificación
  }
}
```

## 🚀 Cómo Usar

### Paso 1: Confirmar que App.tsx tiene ToastProvider

En `src/App.tsx`, verifica:

```typescript
import { ToastProvider } from '@/context/ToastContext'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* tus rutas */}
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

### Paso 2: Usar Hook en Componente

```typescript
import { useToastContext } from '@/context/ToastContext'

export const MiComponente = () => {
  const { success, error, warning, info } = useToastContext()

  const handleDelete = async () => {
    try {
      await deleteItem()
      success('Eliminado', 'El elemento fue eliminado correctamente')
    } catch (err: any) {
      error('Error', err.message)
    }
  }

  return <button onClick={handleDelete}>Eliminar</button>
}
```

## 📝 API del Hook

```typescript
const {
  toasts,              // Array de notificaciones activas
  success,             // Mostrar notificación de éxito
  error,               // Mostrar notificación de error
  warning,             // Mostrar notificación de advertencia
  info,                // Mostrar notificación de info
  dismissToast,        // Cerrar una notificación por ID
  dismissAll           // Cerrar todas las notificaciones
} = useToastContext()
```

### Métodos

**success(title, message?, duration?)**
```typescript
success('Guardado', 'Los cambios se guardaron correctamente')
success('Listo') // sin mensaje
success('Listo', 'Descripción', 3000) // 3 segundos
```

**error(title, message?, duration?)**
```typescript
error('Error de validación', 'El email es requerido')
error('Fallo de conexión') // sin mensaje
// Duración default: 7 segundos (errores importantes)
```

**warning(title, message?, duration?)**
```typescript
warning('¡Cuidado!', 'Esta acción no se puede deshacer')
```

**info(title, message?, duration?)**
```typescript
info('Información', 'El sistema está en mantenimiento')
```

## 🎨 Estilos por Tipo

- **success** 🟢 - Verde, para operaciones exitosas
- **error** 🔴 - Rojo, para errores
- **warning** 🟡 - Ámbar, para advertencias
- **info** 🔵 - Azul, para información

## ⏱️ Duración Auto-dismiss

Por defecto, los toasts se cierran automáticamente:

```typescript
success(title, msg)        // 5 segundos
error(title, msg)          // 7 segundos (más tiempo para errores)
warning(title, msg)        // 6 segundos
info(title, msg)           // 5 segundos
showToast(type, msg, 0)    // 0 = nunca se cierra (usuario debe hacer click)
showToast(type, msg, 3000) // 3 segundos custom
```

## 📍 Posición en Pantalla

Por defecto aparecen en `bottom-right` (abajo a la derecha). 

Para cambiar, edita `ToastProvider`:
```typescript
<ToastContainer 
  toasts={toasts} 
  onDismiss={dismissToast} 
  position="top-right"  // Otras: top-left, top-center, etc.
/>
```

## 🔧 Casos de Uso Reales

### 1. Guardar Formulario

```typescript
const handleSave = async () => {
  const { success, error } = useToastContext()
  
  try {
    setIsLoading(true)
    await supabase.from('usuarios').insert(formData)
    success('Usuario creado', `${formData.nombre} fue agregado correctamente`)
    setFormData({}) // limpiar
  } catch (err: any) {
    error('No se pudo crear usuario', err.message)
  } finally {
    setIsLoading(false)
  }
}
```

### 2. Eliminar Elemento

```typescript
const handleDelete = async (id: number) => {
  const { success, error } = useToastContext()
  
  if (!confirm('¿Estás seguro?')) return
  
  try {
    await supabase.from('items').delete().eq('id', id)
    success('Eliminado', 'El elemento fue removido')
    refetch() // recargar lista
  } catch (err: any) {
    error('Error al eliminar', err.message)
  }
}
```

### 3. Operación Larga

```typescript
const handleImport = async (file: File) => {
  const { info, success, error } = useToastContext()
  
  try {
    info('Procesando', 'Importando archivo...')
    const result = await importData(file)
    success('Importado', `${result.count} registros procesados`)
  } catch (err: any) {
    error('Fallo la importación', err.message)
  }
}
```

## ❌ Errores Comunes

### ❌ No funciona - "useToastContext debe ser usado dentro de ToastProvider"

**Solución:** Verifica que `ToastProvider` envuelva tu componente en `App.tsx`

### ❌ El toast desaparece muy rápido

**Solución:** Aumenta duración:
```typescript
error('Mi error', 'Mensaje', 10000) // 10 segundos
```

### ❌ Quiero usar en un hook personalizado

```typescript
// hooks/useApiCall.ts
import { useToastContext } from '@/context/ToastContext'

export const useApiCall = () => {
  const { error, success } = useToastContext()
  
  const call = async (endpoint: string) => {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('API error')
      success('Listo', 'Operación exitosa')
      return res.json()
    } catch (err: any) {
      error('Error de API', err.message)
      throw err
    }
  }
  
  return { call }
}
```

## 📋 Migración de `console.error()` → Toast

En el código actual hay muchos lugares con `console.error()`:

```typescript
// ❌ ANTES
catch (error) {
  console.error('Error loading data:', error)
}

// ✅ DESPUÉS
const { error: showError } = useToastContext()
catch (err: any) {
  showError('Error cargando datos', err.message)
}
```

## 🎯 Próximos Pasos

Actualiza estos archivos para usar Toast en lugar de console:

- `src/pages/admin/Clientes.tsx` - Líneas donde usa alert/console
- `src/pages/admin/Convenios.tsx` - Manejo de errores
- `src/pages/admin/Pagos.tsx` - Validaciones
- `src/components/forms/*.tsx` - Todos los formularios
- `src/hooks/useSupabaseQuery.ts` - Manejo de errores

---

**Sistema listo para usar. Toast Provider está activo en App.tsx.**
