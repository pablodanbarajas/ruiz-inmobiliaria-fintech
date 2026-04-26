# Portal Cliente — Arquitectura y Guía Técnica

## Estructura final de carpetas

```
src/
├── app/
│   ├── App.tsx                        # RouterProvider únicamente
│   ├── routes.tsx                     # Definición de rutas públicas y privadas
│   │
│   ├── config/
│   │   └── env.ts                     # Acceso centralizado a variables de entorno
│   │
│   ├── context/
│   │   └── AuthContext.tsx            # Estado global de sesión (Provider + hook interno)
│   │
│   ├── hooks/
│   │   └── useAuth.ts                 # API pública de autenticación para componentes
│   │
│   ├── types/                         # Única fuente de verdad de tipos del dominio
│   │   ├── auth.types.ts              # ClientUser, AuthSession, LoginCredentials
│   │   ├── development.types.ts       # PublicDevelopment
│   │   ├── lot.types.ts               # ClientLot, MapLot (preparado para mapa)
│   │   ├── payment.types.ts           # Payment, PaymentSummary, QuentliReference
│   │   └── support.types.ts           # SupportTicket, CreateTicketPayload
│   │
│   ├── services/
│   │   ├── index.ts                   # ★ Registro central — aquí se elige mock vs real
│   │   ├── interfaces/
│   │   │   └── index.ts               # IAuthService, ILotsService, etc.
│   │   ├── mock/                      # Implementaciones de desarrollo
│   │   │   ├── auth.service.ts
│   │   │   ├── developments.service.ts
│   │   │   ├── lots.service.ts
│   │   │   ├── payments.service.ts
│   │   │   └── support.service.ts
│   │   └── supabase/                  # Implementaciones de producción (stubs listos)
│   │       ├── client.ts              # createClient() — activar con env vars
│   │       └── auth.service.ts        # Stub con pasos comentados
│   │
│   ├── data/
│   │   └── mock/                      # Solo datos estáticos de prueba
│   │       ├── auth.mock.ts
│   │       ├── developments.mock.ts
│   │       ├── lots.mock.ts
│   │       └── payments.mock.ts
│   │
│   ├── guards/
│   │   └── ClientRoute.tsx            # Protección de rutas privadas
│   │
│   ├── layouts/
│   │   ├── PublicLayout.tsx
│   │   └── ClientLayout.tsx
│   │
│   ├── pages/
│   │   ├── public/
│   │   │   ├── Home.tsx
│   │   │   ├── Soporte.tsx
│   │   │   ├── LoginCliente.tsx
│   │   │   ├── RegistroCliente.tsx
│   │   │   └── MapaDesarrollo.tsx     # Punto de entrada del mapa interactivo (futuro)
│   │   └── client/
│   │       ├── PortalHome.tsx
│   │       ├── PortalSoporte.tsx
│   │       ├── MisLotes.tsx
│   │       └── MisPagos.tsx
│   │
│   └── components/
│       ├── common/
│       │   ├── Header.tsx             # Lee sesión del contexto, logout integrado
│       │   ├── Sidebar.tsx
│       │   └── Footer.tsx
│       ├── home/
│       │   ├── HomeContent.tsx        # Carga desarrollos vía developmentsService
│       │   └── DevelopmentCard.tsx
│       ├── lotes/
│       │   └── LotCard.tsx
│       ├── shared/
│       │   └── SummaryCard.tsx
│       ├── support/
│       │   └── SoporteContent.tsx     # Lee sesión del contexto, envía tickets vía servicio
│       └── ui/                        # Componentes shadcn/ui — no modificar
│
├── styles/
│   ├── tailwind.css
│   ├── theme.css
│   └── fonts.css
│
└── main.tsx                           # <AuthProvider><App /></AuthProvider>
```

---

## Decisiones técnicas

### 1. AuthContext como única fuente de verdad de sesión

**Qué había:** la sesión se leía directo de `mockSession` en cada archivo que la necesitaba. No había estado reactivo de React, lo que significaba que un logout no se propagaba.

**Qué se hizo:** se creó `AuthContext` con `useState`, de modo que cualquier cambio en la sesión (login, logout) actualiza automáticamente todos los componentes suscritos.

**Por qué importa para Supabase:** al migrar, basta con agregar `supabase.auth.onAuthStateChange` dentro del `AuthProvider` y el resto de la app reacciona sin cambios.

---

### 2. Registro central de servicios en `services/index.ts`

**Qué había:** cada archivo importaba el mock que necesitaba directamente.

**Qué se hizo:** se creó un único punto de despacho que exporta los servicios activos. Toda la app importa de `services/index.ts`, no de implementaciones individuales.

**Por qué importa:** para pasar a producción, solo se cambian cuatro líneas en `services/index.ts`. Sin tocar páginas, componentes ni contextos.

---

### 3. Interfaces de servicio como contrato

Todas las implementaciones (mock y futura Supabase) implementan la misma interfaz (`IAuthService`, `ILotsService`, etc.). Esto garantiza que el contrato no cambie al cambiar la implementación.

---

### 4. Tipos en `types/` separados de los datos mock

**Qué había:** `LotCard` importaba `Lot` de `data/mock/lots.mock`. `MisPagos` importaba `PaymentStatus` de `data/mock/payments.mock`. Los tipos estaban acoplados a la capa de datos.

**Qué se hizo:** todos los tipos del dominio viven en `types/`. Los mocks importan desde ahí, no al revés.

---

### 5. Header y SoporteContent consumen el contexto directamente

En lugar de recibir `user`, `isAuthenticated` o `userName` por props desde cada layout o página, estos componentes ahora leen el estado desde `useAuth()`. Esto elimina el prop drilling y garantiza que siempre estén sincronizados con el estado real de sesión.

---

### 6. `MapLot` preparado para mapa interactivo

En `types/lot.types.ts` se definió `MapLot` con los campos que necesitará el mapa: estado del lote (disponible, apartado, vendido), superficie y `position` para ubicación en el plano. La página `MapaDesarrollo.tsx` ya existe como punto de entrada. Cuando se integre el visor, los datos deberán venir de un servicio independiente que no exponga información financiera ni del cliente.

---

### 7. `QuentliReference` y `QuentliWebhookPayload` documentados en tipos

Los tipos de Quentli están definidos en `types/payment.types.ts` con notas explícitas de que la generación de referencias y la validación de webhooks deben hacerse en backend/Edge Functions. El frontend solo muestra estado final.

---

## Riesgos detectados

### Riesgo 1 — Seguridad: `ClientRoute` solo protege navegación frontend ★★★★★

**Estado actual:** `ClientRoute` redirige al login si no hay sesión. Pero si Supabase no tiene RLS activo, una petición directa a la API devolvería datos de cualquier usuario.

**Mitigación requerida antes de producción:** activar RLS en todas las tablas de Supabase. La protección de rutas en frontend es conveniente, no es seguridad.

---

### Riesgo 2 — Sesión mock siempre autenticada ★★★★☆

**Estado actual:** `mockAuthSession` tiene `isAuthenticated: true`. Esto es intencional para desarrollo, pero si se olvida cambiar al implementar Supabase, el portal quedaría abierto.

**Mitigación:** al activar Supabase, la sesión inicial debe leerla de `supabase.auth.getSession()`, que devuelve `null` si no hay sesión activa.

---

### Riesgo 3 — `RegistroCliente.tsx` no tiene capa de servicio ★★★☆☆

**Estado actual:** `RegistroCliente` no fue tocado en este refactor porque no tenía lógica de negocio activa. Al conectar Supabase, deberá usar `authService.register()` a través del contexto, no llamar a Supabase directamente.

**Mitigación:** agregar `register()` a `IAuthService` cuando se implemente.

---

### Riesgo 4 — `MapaDesarrollo.tsx` no tiene capa de servicio ★★★☆☆

**Estado actual:** la página del mapa existe pero no tiene integración. Cuando se integre el visor de lotes, los datos de disponibilidad deben venir de un `mapService` que solo exponga `MapLot` (sin precios ni datos de cliente).

---

### Riesgo 5 — Pagos y recibos sin backend ★★★★★

**Estado actual:** los botones "Pagar ahora" y "Ver recibo" no tienen implementación.

**Mitigación requerida:** estos flujos requieren backend server-side (Edge Functions en Supabase). El frontend nunca debe generar referencias de cobro ni firmar recibos directamente.

---

## Pendientes para conexión real

### Paso 1 — Activar Supabase

```bash
npm install @supabase/supabase-js
```

1. Crear archivo `.env` desde `.env.example`
2. Rellenar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
3. En `services/supabase/client.ts`: descomentar `createClient()`
4. Implementar `services/supabase/auth.service.ts`
5. En `services/index.ts`: reemplazar `mockAuthService` por `supabaseAuthService`

### Paso 2 — Auth real

En `context/AuthContext.tsx`, agregar dentro del `useEffect` inicial:

```typescript
// Leer sesión existente al cargar
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(mapSupabaseSession(session));
});

// Escuchar cambios de sesión (login/logout desde otra pestaña, expiración, etc.)
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setSession(mapSupabaseSession(session));
});

return () => subscription.unsubscribe();
```

### Paso 3 — Tablas y RLS recomendados

```sql
-- Tabla de perfiles de cliente (extiende auth.users de Supabase)
CREATE TABLE public.client_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Solo el cliente puede ver y editar su propio perfil
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_propio_perfil"
  ON public.client_profiles FOR ALL
  USING (auth.uid() = id);

-- Tabla de desarrollos (pública)
CREATE TABLE public.developments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  image_url       TEXT,
  available_lots  INT DEFAULT 0,
  location        TEXT,
  maps_url        TEXT,
  is_active       BOOLEAN DEFAULT TRUE
);

-- Cualquiera puede leer desarrollos activos
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "desarrollos_publicos"
  ON public.developments FOR SELECT
  USING (is_active = TRUE);

-- Tabla de lotes de clientes (privada)
CREATE TABLE public.client_lots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES auth.users(id),
  development_id   UUID NOT NULL REFERENCES public.developments(id),
  lot_key          TEXT NOT NULL,
  surface          TEXT,
  price            NUMERIC,
  image_url        TEXT,
  status           TEXT NOT NULL CHECK (status IN ('apartado','apartado_confirmado','en_pagos','finalizado')),
  current_stage    INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Solo el cliente propietario puede ver sus lotes
ALTER TABLE public.client_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_solo_sus_lotes"
  ON public.client_lots FOR SELECT
  USING (auth.uid() = client_id);

-- Tabla de pagos (privada)
CREATE TABLE public.payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES auth.users(id),
  lot_id      UUID REFERENCES public.client_lots(id),
  lot_key     TEXT,
  reason      TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pendiente','atrasado','por_vencer','pagado')),
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Solo el cliente propietario puede ver sus pagos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_solo_sus_pagos"
  ON public.payments FOR SELECT
  USING (auth.uid() = client_id);
```

### Paso 4 — Implementar servicios Supabase

Crear en `services/supabase/`:
- `developments.service.ts` — `supabase.from('developments').select('*').eq('is_active', true)`
- `lots.service.ts` — `supabase.from('client_lots').select('*')` (RLS filtra por `auth.uid()`)
- `payments.service.ts` — idem

### Paso 5 — Mapa interactivo

1. Crear `services/interfaces/map.interface.ts` con `IMapService`
2. Crear `services/mock/map.service.ts` con datos de prueba de `MapLot`
3. Implementar el visor en `pages/public/MapaDesarrollo.tsx`
4. El visor solo consume `MapLot` (sin datos financieros ni del cliente)
5. Para lotes disponibles que el cliente quiera apartar: redirigir a login si no está autenticado, o iniciar flujo de apartado si lo está

### Paso 6 — Integración Quentli (pagos)

⚠️ **Todo este flujo debe ocurrir en backend, nunca en frontend.**

Arquitectura recomendada con Supabase Edge Functions:

```
Frontend                Edge Function (Supabase)         Quentli API
─────────               ──────────────────────────       ──────────
Clic "Pagar" ──────────► POST /generate-reference  ────► Genera referencia
             ◄──────────  { paymentUrl, referenceId }◄───
Redirige a paymentUrl

(Quentli confirma pago)
                        ◄─── POST /quentli-webhook ◄──── Webhook
                              Valida firma HMAC
                              UPDATE payments SET status='pagado'
```

Crear en Supabase:
- `supabase/functions/generate-payment-reference/index.ts`
- `supabase/functions/quentli-webhook/index.ts` (validar HMAC, nunca confiar solo en el payload)

---

## Convivencia con el sistema interno

El sistema interno es un proyecto independiente que comparte la misma base de datos Supabase.

### Separación de roles

```sql
-- En Supabase Auth, los roles se manejan con custom claims o tabla de roles
CREATE TABLE public.user_roles (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id),
  role     TEXT NOT NULL CHECK (role IN ('client', 'admin', 'comercial'))
);

-- El portal cliente NUNCA accede a esta tabla directamente.
-- Solo lee el claim del JWT: session.user.role === 'client'
```

### Reglas de aislamiento

| Regla | Portal cliente | Sistema interno |
|-------|---------------|-----------------|
| Login | `supabase.auth.signIn` con rol `client` | Login propio o mismo Supabase con rol `admin/comercial` |
| Acceso a pagos | Solo los propios (RLS) | Todos (solo desde backend) |
| Acceso a lotes | Solo los propios (RLS) | Todos (solo desde backend) |
| Modificar datos | No puede | Sí puede (con permisos) |
| Ver datos de otros clientes | No puede (RLS) | Sí puede (service_role en backend) |

### Convención de namespaces sugerida

- Tablas del portal cliente: sin prefijo (`developments`, `client_lots`, `payments`)
- Tablas del sistema interno: prefijo `crm_` (`crm_leads`, `crm_activities`, `crm_agents`)
- Tablas compartidas: `client_profiles`, `developments`, `client_lots`

La `service_role` key solo debe estar en el backend del sistema interno, nunca en el portal cliente.

---

## Recomendaciones de seguridad concretas

1. **Activar RLS en todas las tablas** antes de ir a producción. Sin RLS, la `anon key` da acceso de lectura a toda la base de datos.

2. **Validar webhooks de Quentli con HMAC** en la Edge Function. Nunca actualizar el estado de un pago solo porque el frontend lo diga.

3. **Recibos en PDF**: generar en Edge Function con acceso a datos del servidor. El frontend solo recibe una URL firmada y temporal (Supabase Storage con signed URLs con expiración de 5 minutos).

4. **No usar `service_role` key en el cliente**. Si en algún momento necesitas hacer algo que requiera `service_role`, es señal de que esa lógica debe estar en una Edge Function.

5. **Expiración de sesión**: Supabase renueva tokens automáticamente. Configurar `autoRefreshToken: true` al crear el cliente (es el default).

6. **Rate limiting en formulario de soporte**: implementar en Edge Function o en Supabase con `pg_cron` + contador por IP/email para evitar spam.

7. **Variables de entorno**: nunca hardcodear URLs ni keys en código fuente. Usar siempre `env.ts` como punto de acceso.
