# Ruiz Inmobiliaria - Sistema Fintech de Gestión de Lotes

Panel de administración web para la gestión de lotes inmobiliarios, clientes, ventas y pagos. Construcción solamente lectura (consultas).

## 🚀 Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Autenticación**: Supabase Auth
- **Base de Datos**: PostgreSQL (Supabase)
- **UI Components**: shadcn/ui + Tailwind CSS
- **Tablas**: TanStack Table
- **Routing**: React Router v6
- **Estado Global**: Hooks nativos de React

## 📋 Funcionalidades

### Módulos Implementados

1. **Dashboard** - Resumen estadístico del sistema
2. **Desarrollos** - Listado y detalle de proyectos inmobiliarios
3. **Lotes** - Catálogo de terrenos con filtros avanzados
4. **Clientes** - Base de datos de compradores
5. **Ventas** - Histórico de transacciones
6. **Pagos** - Registro de pagos y corrida financiera

### Características

- ✅ Autenticación con email/contraseña
- ✅ Protección de rutas (solo usuarios autenticados)
- ✅ Listados con filtros y búsqueda
- ✅ Páginas de detalle con información relacionada
- ✅ Responsive Design (mobile-first)
- ✅ UI moderna y consistente

## 🛠️ Instalación

### Requisitos

- Node.js 16+ y npm
- Cuenta en Supabase con base de datos configurada

### Pasos

1. **Clonar repositorio** (si aplica)
   ```bash
   git clone <repository-url>
   cd ruiz-inmobiliaria-fintech
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Crear archivo `.env.local` en la raíz del proyecto:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

5. **Acceder a la aplicación**
   
   Abre tu navegador en `http://localhost:5173`

## 🔐 Configuración de Supabase

### 1. Crear usuarios de prueba

En Supabase Authentication, crea usuarios con:
- Email: `admin@example.com`
- Contraseña: (la que desees)

### 2. Metadatos de usuario (opcional)

Puedes agregar metadatos adicionales al usuario en Supabase:
```json
{
  "nombre": "Admin",
  "apellido": "User"
}
```

### 3. Verificar permisos RLS (Row Level Security)

Asegúrate que las tablas tengan políticas RLS permitidas para lectura pública o autenticada:

```sql
-- Ejemplo para tabla cliente
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON cliente
  FOR SELECT
  USING (true);
```

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AdminLayout.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── DataTable.tsx
│   └── ProtectedRoute.tsx
├── pages/
│   ├── auth/
│   │   └── Login.tsx
│   └── admin/
│       ├── Dashboard.tsx
│       ├── Desarrollos.tsx
│       ├── DesarrolloDetail.tsx
│       ├── Lotes.tsx
│       ├── LoteDetail.tsx
│       ├── Clientes.tsx
│       ├── ClienteDetail.tsx
│       ├── Ventas.tsx
│       ├── VentaDetail.tsx
│       ├── Pagos.tsx
│       └── PagoDetail.tsx
├── lib/
│   └── supabaseClient.ts
├── hooks/
│   ├── useAuth.ts
│   └── useSupabaseQuery.ts
├── types/
│   └── database.ts
├── utils/
│   ├── cn.ts
│   └── helpers.ts
├── App.tsx
├── main.tsx
└── index.css
```

## 🔄 Flujos Principales

### Autenticación
1. Usuario accede a `/login`
2. Ingresa email y contraseña
3. Supabase valida credenciales
4. Se redirige a `/admin/dashboard`
5. Estado de autenticación se mantiene en sesión

### Consulta de Datos
1. Componente monta (useEffect)
2. Hook ejecuta query Supabase
3. Datos se almacenan en estado local
4. UI se renderiza con datos
5. Cambios en filtros disparan nuevas queries

### Navegación
1. Sidebar proporciona navegación principal
2. Cada módulo tiene listado y páginas de detalle
3. Links relacionados permiten exploración cruzada
4. Botón "Volver" retorna al listado

## 📊 Modelos de Datos

### Cliente
- clienteid (PK)
- nombre, email, rfc, curp
- direccion completa (calle, colonia, municipio, estado)
- contacto (teléfono celular, teléfono 2)
- datos bancarios y personales (sexo, estado civil)

### Desarrollo
- desarrolloid (PK)
- clavedesarrollo, nombre
- tipodesarrolloid (FK)
- estatus (A/I)

### Lote
- loteid (PK)
- desarrolloid (FK)
- duenioid (FK)
- manzana, nolote
- preciolote, estatus

### Venta
- ventaid (PK)
- loteid, clienteid (FK)
- fecha, preciolote, enganche, plazo
- fechaprimeramensualidad, estatus

### CorridaFinanciera
- corridafinancieraid (PK)
- ventaid (FK)
- nopago, fecha, saldo, mensualidad

### Pago
- pagoid (PK)
- corridafinancieraid (FK)
- fechapago, montopagado, formapago, estatus

## 🎨 Personalización

### Colores y Tema

Edita `tailwind.config.ts` para customizar colores:

```typescript
theme: {
  extend: {
    colors: {
      primary: '#YourColor',
    },
  },
}
```

### Componentes UI

Los componentes están en `src/components/ui/`. Puedes:
- Crear nuevos componentes
- Modificar estilos
- Agregar variantes

## 🚀 Build para Producción

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para despliegue.

### Desplegar en Vercel

1. Conecta tu repositorio a Vercel
2. Agrega variables de entorno en configuración
3. Deploy automático en cada push

## 🔧 Desarrollo

### Scripts disponibles

```bash
npm run dev       # Inicia servidor de desarrollo
npm run build     # Compila para producción
npm run preview   # Previsualiza build local
npm run lint      # Verifica TypeScript
```

### Hot Module Replacement (HMR)

Los cambios se reflejan automáticamente mientras desarrollas.

## 📝 Notas Importantes

- ✅ **Solo Lectura**: El sistema actual no permite crear, editar ni eliminar registros
- ✅ **Autenticación**: Implementada con Supabase Auth (email/password)
- ✅ **RLS**: Asegúrate de configurar Row Level Security en Supabase
- ⚠️ **Variables de Entorno**: NUNCA pusheues `.env.local` al repositorio

## 🔮 Próximas Fases

- [ ] Funcionalidad de edición de registros
- [ ] Panel de cliente (para compradores)
- [ ] Integración de pagos online
- [ ] Reportes y exportación PDF
- [ ] Notificaciones por email
- [ ] Dashboard avanzado con gráficos

## 📞 Soporte

Para preguntas o problemas:
1. Verifica la documentación de Supabase
2. Revisa los logs de la consola del navegador
3. Consulta con el equipo de desarrollo

## 📄 Licencia

Privado - Ruiz Inmobiliaria

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
