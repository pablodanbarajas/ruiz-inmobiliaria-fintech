# Portal Cliente - Implementación de Servicios Reales de Supabase

## ✅ Cambios Realizados

### 1. **Vistas SQL Creadas** `supabase/portal_cliente_views.sql`
   - `public_developments` - Desarrollos públicos sin autenticación
   - `client_lots` - Lotes del cliente (RLS por email)
   - `vista_pagos_cliente` - Pagos del cliente (RLS por email)
   - `calcular_recargo()` - Función para calcular recargos automáticamente

### 2. **Servicios Supabase Actualizados**
   - ✅ `portalCliente/src/app/services/supabase/auth.service.ts`
     - Ahora recupera `clienteid` del cliente autenticado
     - Usa el email para buscar el cliente
     - Establece `clienteid` como ID de sesión (para vistas RLS)
   
   - ✅ `portalCliente/src/app/context/AuthContext.tsx`
     - Enriquece sesión con datos del cliente (nombre, clienteid)
     - Sincroniza con tabla `cliente` por email

### 3. **Servicios Existentes (Ya Listos)**
   - ✅ `lotsService` - Obtiene lotes del cliente desde `client_lots`
   - ✅ `paymentsService` - Obtiene pagos desde `vista_pagos_cliente`
   - ✅ `developmentsService` - Obtiene desarrollos desde `public_developments`

---

## 🚀 PASOS PARA IMPLEMENTAR

### Paso 1: Aplicar las vistas SQL en Supabase

1. Abre [Supabase Console](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Copia el contenido de `supabase/portal_cliente_views.sql`
5. Pega y ejecuta (Click en **Run**)

**Esperado:** No debe haber errores. Si hay errores, probablemente falta la tabla `cliente` o tiene columnas diferentes.

### Paso 2: Verificar variables de entorno

En `portalCliente/.env` o `portalCliente/.env.local`, asegúrate de tener:

```env
VITE_SUPABASE_URL=https://[tu-proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Paso 3: Probar el Login

1. Asegúrate de tener un usuario en `auth.users` (Supabase Auth)
2. Asegúrate de que ese usuario tiene un email que coincide con una fila en tabla `cliente`
3. Intenta hacer login con ese email

```javascript
// Ejemplo: Email "juan@example.com" debe existir en:
// - auth.users (Supabase Auth)
// - cliente.email = "juan@example.com"
```

### Paso 4: Verificar las vistas

En Supabase SQL Editor, ejecuta:

```sql
-- Ver qué desarrollos devuelve
SELECT * FROM public_developments;

-- Ver qué lotes devuelve para un email
SELECT * FROM client_lots 
WHERE user_id = auth.uid();

-- Ver qué pagos devuelve
SELECT * FROM vista_pagos_cliente 
WHERE user_id = auth.uid();
```

---

## 🔍 VERIFICACIÓN DE IMPLEMENTACIÓN

### ✅ Checklist

- [ ] Las vistas SQL fueron creadas sin errores
- [ ] Login funciona con credenciales válidas
- [ ] Session.user.id contiene el `clienteid` (número, no UUID)
- [ ] `lotsService.getClientLots(clientId)` retorna lotes del cliente
- [ ] `paymentsService.getClientPayments(clientId)` retorna pagos del cliente
- [ ] Las páginas `MisLotes` y `MisPagos` muestran datos reales (no mocks)

### Troubleshooting

**Error: "Unable to connect to Supabase"**
- Verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están correctos
- Verifica que tu proyecto Supabase está activo

**Error: "Relation not found"**
- Las vistas SQL no fueron creadas
- Ejecuta nuevamente `supabase/portal_cliente_views.sql`

**Error: "user_id mismatch"**
- El email del usuario no coincide con ningún cliente
- Verifica que `cliente.email` existe y coincide exactamente

**Datos vacíos o sin mostrar**
- Las vistas devuelven datos pero las páginas no los muestran
- Verifica que `MisLotes.tsx` y `MisPagos.tsx` usan `clientId` de la sesión correctamente

---

## 📝 CAMBIOS EN COMPONENTES (Si es necesario)

Si las páginas `MisLotes.tsx` o `MisPagos.tsx` aún usan datos mock, actualiza:

```typescript
// ANTES (con mock):
const { mockLots } = useMockData()
const [lotes, setLotes] = useState(mockLots)

// DESPUÉS (con Supabase):
import { useAuthContext } from '../context/AuthContext'
import { lotsService } from '../services'

const { session } = useAuthContext()
const [lotes, setLotes] = useState<ClientLot[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  if (!session.isAuthenticated || !session.user?.id) return
  
  const loadLots = async () => {
    try {
      const data = await lotsService.getClientLots(session.user.id)
      setLotes(data)
    } catch (error) {
      console.error('Error loading lots:', error)
    } finally {
      setLoading(false)
    }
  }
  
  loadLots()
}, [session.isAuthenticated, session.user?.id])
```

---

## 🔐 SEGURIDAD - Row Level Security (RLS)

Las vistas usan `auth.jwt() ->> 'email'` para filtrar por usuario.

Esto significa:
- Solo clientes autenticados pueden ver sus datos
- Cada cliente solo ve sus lotes y pagos
- Un cliente NO puede ver datos de otro cliente

Si algo no filtra correctamente, verifica:
1. RLS está habilitado en la tabla `cliente`
2. La política de RLS usa la columna `email` correctamente

---

## 📊 STATUS ACTUAL

| Componente | Status | Nota |
|-----------|--------|------|
| Auth Service | ✅ Actualizado | Ahora obtiene clienteid |
| AuthContext | ✅ Actualizado | Enriquece con datos cliente |
| Servicios Supabase | ✅ Listos | lotsService, paymentsService, developmentsService |
| Vistas SQL | ✅ Creadas | public_developments, client_lots, vista_pagos_cliente |
| Páginas (MisLotes, MisPagos) | ⚠️ Requiere verificación | Necesita confirmar que usan servicios reales |

---

## 🎯 Próximos Pasos

1. ✅ Aplicar vistas SQL
2. ✅ Verificar login funciona
3. ✅ Confirmar que MisLotes y MisPagos muestran datos reales
4. 🔄 Si algo falla, revisar console del navegador y logs de Supabase

---

**Generado:** 2026-06-11  
**Prioridad:** 🔴 CRÍTICO - Portal cliente debe funcionar con datos reales
