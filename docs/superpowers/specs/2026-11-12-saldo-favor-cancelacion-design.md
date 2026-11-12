# Saldo a favor al cancelar una venta

Fecha: 2026-11-12 · Estado: diseño aprobado en conversación, pendiente de revisión escrita

## Objetivo

Cuando se cancela una venta que tiene saldo a favor, quien cancela debe decidir qué pasa con ese dinero: **reembolsarlo** al cliente o **retenerlo**. La decisión queda registrada con quién la tomó y cuándo, para que nunca haya saldo de una venta cancelada sin destino conocido.

## Alcance

**Incluye**

- Tabla nueva `saldo_favor_cierres` y una función de base de datos que registra la decisión.
- Pregunta en el cuadro de cancelación del detalle de la venta.
- Aviso de "pendiente de decidir" en el detalle de ventas ya canceladas.
- Mostrar en el detalle de la venta todas sus devoluciones (hoy solo muestra una).
- Bloquear en la base que se use saldo a favor en una venta cancelada.

**No incluye (decisión del usuario, 2026-11-12)**

- Saldo por cliente ni traspasos entre ventas. El saldo a favor sigue siendo independiente por venta, como hoy. Se agregará solo si lo piden.
- Cambios al portal del cliente: las ventas canceladas no se muestran ahí.

## Contexto actual

- El saldo a favor de una venta = abonos (`servicios_extra` positivo) − saldo usado (`saldo_favor_aplicado`, o `servicios_extra` negativo en registros viejos), sin pagos cancelados. Lo calcula `src/utils/pagos.ts`.
- En Prod (2026-11-12): 109 abonos por $24,774.99 en 34 ventas de 25 clientes; nadie ha usado saldo todavía. **Una venta ya cancelada tiene $200 de saldo** sin decisión.
- `handleCancelVenta` (`src/pages/admin/VentaDetail.tsx`) marca la venta como `C`, libera el lote, crea una devolución si se pagó más del 20% del precio (en parcialidades) y cancela la suscripción y facturas de Quentli.
- Las devoluciones (`devoluciones`, `devolucion_parcialidades`) solo se muestran y pagan en el detalle de la venta, que las carga con `.maybeSingle()`: **asume una devolución por venta**.
- También cancelan ventas: Ventas Externas (apartados) y el vencimiento automático de reservas. Normalmente no tienen saldo.

## Diseño

### Datos: tabla `saldo_favor_cierres`

Un registro por venta cancelada que tenía saldo a favor.

| Columna | Tipo | Notas |
|---|---|---|
| `cierreid` | `bigint` identity | PK |
| `ventaid` | `integer` NOT NULL | FK a `venta`, **UNIQUE**: una decisión por venta |
| `monto` | `numeric(12,2)` NOT NULL | saldo de la venta al decidir; `CHECK (monto > 0)` |
| `decision` | `text` NOT NULL | `CHECK (decision IN ('reembolso', 'retencion'))` |
| `devolucionid` | `integer` NULL | FK a `devoluciones`; obligatorio si es reembolso, nulo si es retención (`CHECK`) |
| `nota` | `text` NULL | opcional, la escribe quien decide |
| `created_by` | `uuid` NOT NULL | `auth.uid()` de quien decidió |
| `created_by_nombre` | `text` NOT NULL | nombre de quien decidió, tomado de su sesión (`user_metadata` nombre y apellido, o su correo); no hay tabla de usuarios con nombres |
| `created_at` | `timestamptz` NOT NULL | `now()` |

RLS: lectura para el personal interno del panel (los mismos roles que `devoluciones_panel_all`). **Sin políticas de INSERT, UPDATE ni DELETE**: solo se escribe por la función de abajo. Una decisión no se edita ni se borra desde la app; un error se corrige a mano en la base con una nota.

### Función `cerrar_saldo_favor(p_ventaid, p_decision, p_nota)`

`SECURITY DEFINER`, `search_path` fijo, ejecutable solo por `authenticated`. En una sola transacción:

1. Verifica que quien llama tenga uno de los roles que deciden: `admin`, `finanzas`, `cobranza_caja`, `contratos`. Si no, error de permisos.
2. Bloquea la fila de la venta (`FOR UPDATE`) y verifica que esté cancelada (`estatus = 'C'`).
3. Verifica que no exista ya un cierre para esa venta.
4. Calcula el saldo en la base con la misma regla de `src/utils/pagos.ts`. Si es 0 o menos, error "La venta no tiene saldo a favor".
5. Si es **reembolso**: crea una devolución (`motivo = 'Reembolso de saldo a favor'`, `monto_total = saldo`, `estatus = 'P'`, `clienteid` de la venta) con **una sola parcialidad** por el total.
6. Inserta el cierre y regresa `cierreid`, `monto` y `devolucionid`.

El monto nunca lo manda la pantalla: siempre lo calcula la base.

Una función auxiliar `saldo_favor_venta(p_ventaid)` (`STABLE`) calcula el saldo y la usan esta función y el trigger de abajo.

### Regla: no usar saldo en una venta cancelada

Trigger `BEFORE INSERT OR UPDATE` en `pagos`. Rechaza con "No se puede usar saldo a favor de una venta cancelada" cuando la venta de esa mensualidad está cancelada, el pago no está cancelado (`estatus <> 'C'`) y el saldo usado **sube** (en INSERT, `saldo_favor_aplicado > 0`; en UPDATE, mayor que el valor anterior). Así se puede seguir editando o cancelando un pago viejo de una venta cancelada, pero no usar saldo nuevo después de cancelar o de cerrar.

Si después de cerrar se cancela un pago de esa venta y el saldo calculado cambia, el cierre conserva el monto que se decidió; no se recalcula.

### Pantalla: detalle de la venta

**Cancelar una venta con saldo.** El cuadro de cancelación consulta el saldo (`fetchSaldoFavorDisponible`, ya existe). Si es mayor a 0:

- Muestra "Esta venta tiene $X de saldo a favor. ¿Qué se hace con él?" con dos opciones obligatorias, *Reembolsar al cliente* y *Retener*, y una nota opcional.
- El botón de confirmar no se habilita hasta elegir.
- Primero se cancela la venta como hoy y después se llama a `cerrar_saldo_favor`. Si esa llamada falla, la venta ya quedó cancelada y el aviso de pendiente (abajo) permite decidir otra vez; se muestra el error.

Si la venta no tiene saldo, el cuadro funciona igual que hoy.

**Venta cancelada con saldo sin decidir.** Si la venta está cancelada, tiene saldo y no tiene cierre, se muestra un aviso: "Saldo a favor pendiente de decidir: $X", con los botones *Reembolsar* y *Retener* (y nota). Cubre la venta de $200 de Prod y las cancelaciones hechas desde otras pantallas.

**Decisión ya tomada.** Se muestra "Saldo a favor de $X: reembolsado (Devolución #N)" o "Saldo a favor de $X: retenido por [nombre] el [fecha]", con la nota si la hay.

**Varias devoluciones.** La sección de devoluciones carga todas las de la venta (sin `.maybeSingle()`) y muestra cada una con sus parcialidades. Una venta puede tener la devolución del 20% y la del saldo a favor al mismo tiempo; son conceptos distintos y no se mezclan.

**Permisos en pantalla.** Los botones de decisión solo aparecen para `admin`, `finanzas`, `cobranza_caja` y `contratos`. Los demás roles ven el aviso sin botones. La base valida lo mismo.

### Archivos

- `supabase/migrations/<fecha>_saldo_favor_cierres.sql`: tabla, RLS, funciones `saldo_favor_venta` y `cerrar_saldo_favor`, trigger en `pagos`.
- `src/utils/pagos.ts`: función para llamar `cerrar_saldo_favor` y leer el cierre de una venta.
- `src/types/database.ts`: tipo `SaldoFavorCierre`.
- `src/pages/admin/VentaDetail.tsx`: cuadro de cancelación, aviso de pendiente, decisión tomada, lista de devoluciones.
- Si `VentaDetail.tsx` crece demasiado, el bloque de saldo a favor va en un componente propio (`src/components/SaldoFavorCierre.tsx`).

## Pruebas (en Test)

- Cancelar una venta con saldo y **reembolsar**: venta `C`, cierre `reembolso`, devolución con una parcialidad por el saldo exacto.
- Cancelar con saldo y **retener**: cierre `retencion` sin devolución; muestra quién y cuándo.
- Cancelar una venta **sin saldo**: no pregunta nada; igual que hoy.
- Venta con más del 20% pagado **y** saldo: dos devoluciones, las dos visibles.
- Decidir desde el **aviso** de una venta ya cancelada.
- **Decidir dos veces** la misma venta: la base lo rechaza.
- Llamar la función sobre una **venta activa**: la base lo rechaza.
- Rol **sin permiso** (vendedor): no ve botones; la llamada directa a la función falla.
- Intentar registrar un pago con saldo a favor en una **venta cancelada**: el trigger lo rechaza.
- `tsc -b`, `vite build` y ESLint sin errores nuevos.

## Despliegue

1. La migración se aplica en Test (por el usuario en el SQL Editor si `apply_migration` la rechaza) y se prueba en el preview.
2. En Prod, el usuario corre la migración en el SQL Editor **antes** de fusionar el PR.
3. Después de publicar, administración resuelve la venta cancelada de $200 con el aviso de pendiente.
