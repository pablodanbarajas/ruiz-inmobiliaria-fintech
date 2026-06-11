# RLS (Row Level Security) - Verificación y Testing

## 📋 Status Actual

- ❌ **RLS NO ha sido verificado en live DB**
- ⚠️ Políticas documentadas en SQL pero aplicación desconocida
- 🔴 **CRÍTICO:** Necesita verificación antes de producción

---

## ✅ PASOS DE VERIFICACIÓN

### Paso 1: Verificar que RLS está habilitado en las tablas

1. Abre **Supabase Console** → **SQL Editor**
2. Ejecuta este script:

```sql
-- Listar todas las tablas con RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Esperado:** Todas las tablas críticas (cliente, venta, pagos, etc.) deben mostrar `rowsecurity = true`

Si alguna muestra `false`, ejecuta:
```sql
ALTER TABLE public.[nombre_tabla] ENABLE ROW LEVEL SECURITY;
```

### Paso 2: Verificar que las políticas están creadas

```sql
-- Listar todas las políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Esperado:** Debe haber ~20-25 políticas creadas

Si no hay políticas, ejecuta:
```sql
-- Aplicar todas las RLS policies
-- (Copiar contenido de supabase/rls_setup.sql)
```

### Paso 3: Aplicar el script de RLS

1. Abre `supabase/rls_setup.sql`
2. Copia TODO el contenido
3. Ve a **Supabase Console** → **SQL Editor**
4. Pega y ejecuta (Click **Run**)
5. Verifica que NO hay errores

---

## 🧪 TESTING DE RLS

### Test 1: Cliente SOLO ve sus datos

1. Abre **Supabase Console** → **Auth Users**
2. Crea 2 usuarios test:
   - `cliente1@example.com` password: `test123456`
   - `cliente2@example.com` password: `test123456`

3. Ve a **SQL Editor** y ejecuta como `cliente1@example.com`:

```sql
-- Switch a usuario cliente1 (esto se hace en el client auth, no en SQL directo)
-- En cambio, usa la consola para simular:

SELECT auth.uid(); -- Verás el UID del usuario autenticado

SELECT * FROM cliente;  
-- ESPERADO: Solo 1 fila (la del cliente1)

SELECT * FROM venta;
-- ESPERADO: Solo ventas del cliente1

SELECT * FROM pagos;
-- ESPERADO: Solo pagos del cliente1
```

### Test 2: Admin ve TODO

```sql
-- Como usuario admin (que tiene role = 'admin' en metadata)

SELECT count(*) as total_clientes FROM cliente;
SELECT count(*) as total_ventas FROM venta;
SELECT count(*) as total_pagos FROM pagos;

-- ESPERADO: Números totales de toda la BD, no filtrados
```

### Test 3: Cobrador ve solo clientes asignados

```sql
-- Como cobrador (role = 'cobrador' en metadata)

SELECT * FROM venta;
-- ESPERADO: Solo ventas donde cobrador = [email del cobrador]
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Problema: "RLS not enabled"
```
Error: "Unable to verify policy for table"
```

**Solución:**
```sql
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta ENABLE ROW LEVEL SECURITY;
-- ... para todas las tablas
```

### Problema: Policies no filtra correctamente

**Causa probable:** El email en metadata no coincide con tabla `cliente`

**Verificar:**
```sql
-- Obtener el email actual del usuario autenticado
SELECT auth.jwt() ->> 'email' as user_email;

-- Verificar si existe ese email en tabla cliente
SELECT * FROM cliente WHERE email = '[aquí poner el email de arriba]';
```

**Solución:** Asegurar que:
- Email en `auth.users` coincida exactamente con `cliente.email`
- No hay espacios en blanco extras

### Problema: Client app no puede conectar con RLS

**Verificar:**
1. RLS está habilitado (Paso 1)
2. Políticas existen (Paso 2)
3. Usuario está autenticado (`session.user` existe)
4. Email en session.user coincide con `cliente.email`

**Debug:**
```javascript
// En portalCliente app
const session = await supabase.auth.getSession()
console.log('User email:', session.data.session?.user.email)

// Luego en SQL:
SELECT * FROM cliente WHERE email = '[email de arriba]'
```

---

## 📊 Checklist Pre-Producción

- [ ] RLS habilitado en todas las tablas (ver Paso 1)
- [ ] ~20-25 políticas creadas (ver Paso 2)
- [ ] Script `rls_setup.sql` ejecutado sin errores
- [ ] Cliente1 ve SOLO sus datos (Test 1)
- [ ] Admin ve TODO (Test 2)
- [ ] Cobrador ve solo asignados (Test 3)
- [ ] Portal cliente obtiene datos correctamente
- [ ] No hay "403 Forbidden" en las vistas

---

## 🚀 Paso a Paso para Implementar

```
1. Abrir Supabase Console → SQL Editor
2. Copiar contenido de supabase/rls_setup.sql
3. Pegar en SQL Editor
4. Click en "Run"
5. Esperar confirmación
6. Ejecutar scripts de TEST (arriba)
7. Si todo pasa: ✅ LISTO
8. Si falla: Revisar sección "Solución de problemas"
```

---

## 🔐 Políticas Implementadas

| Tabla | Política | Descripción |
|-------|----------|-------------|
| cliente | select_own | Cliente ve solo su registro |
| cliente | update_admin | Admin puede actualizar |
| venta | select_own | Cliente ve solo sus ventas |
| venta | select_cobradores | Cobrador ve asignadas |
| corridafinanciera | select_own | Cliente ve solo sus corridas |
| pagos | select_own | Cliente ve solo sus pagos |
| pagos | insert_cobradores | Cobradores pueden registrar |
| convenios | select_own | Cliente ve solo sus convenios |
| convenios | insert_admin | Solo admin puede crear |
| lote | select_cliente_owns | Cliente ve solo sus lotes |
| desarrollo | select_all | Todos ven desarrollos activos |
| cuentas_bancarias | select_admin | Solo admin ve cuentas |

---

## ✋ IMPORTANTE

**RLS es de seguridad CRÍTICA:**
- Sin RLS: Un cliente podría ver datos de otros clientes
- Con RLS: Cada cliente SOLO ve sus datos

**Esto DEBE estar en producción. No es opcional.**

---

**Generado:** 2026-06-11  
**Criticidad:** 🔴 CRÍTICO  
**Tiempo estimado:** 30 minutos para verificar e implementar
