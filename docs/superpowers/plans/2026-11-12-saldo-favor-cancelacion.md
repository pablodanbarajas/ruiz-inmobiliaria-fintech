# Saldo a favor al cancelar una venta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a cancelled sale has saldo a favor, staff must record whether it is refunded or retained; the decision is stored with who and when, and a refund creates a devolución.

**Architecture:** A new table `saldo_favor_cierres` written only by a `SECURITY DEFINER` function `cerrar_saldo_favor`, which computes the balance in the database and, for a refund, creates the devolución in the same transaction. A trigger on `pagos` blocks using new saldo on a cancelled sale. The admin sale detail gets a decision block (in the cancel dialog and as a "pending" notice) and lists every devolución of the sale.

**Tech Stack:** Postgres (Supabase, RLS, plpgsql), React 19 + TypeScript + Vite, supabase-js.

**Spec:** `docs/superpowers/specs/2026-11-12-saldo-favor-cancelacion-design.md`

## Global Constraints

- Saldo stays independent per sale; no transfers between sales, no portal changes.
- Saldo of a sale = Σ abonos (`servicios_extra > 0`) − Σ used (`saldo_favor_aplicado`, plus `−servicios_extra` when negative), over payments with `estatus <> 'C'`. Same rule as `src/utils/pagos.ts`.
- Roles that may decide: `admin`, `finanzas`, `cobranza_caja`, `contratos`. Read access: the internal panel roles of `devoluciones_panel_all` (`admin`, `finanzas`, `vendedor`, `contratos`, `cobranza_caja`, `desarrollo_ri`).
- Only cancelled sales (`venta.estatus = 'C'`); one decision per sale; amount always computed in the DB; no UPDATE/DELETE policies on the new table.
- Refund devolución: `motivo = 'Reembolso de saldo a favor'`, `estatus = 'P'`, one parcialidad for the full amount, `notas = 'Parcialidad 1 de 1'`.
- UI copy (Spanish): "Esta venta tiene $X de saldo a favor. ¿Qué se hace con él?", options "Reembolsar al cliente" / "Retener"; pending notice "Saldo a favor pendiente de decidir: $X"; decided "Saldo a favor de $X: reembolsado (Devolución #N)" / "Saldo a favor de $X: retenido por [nombre] el [fecha]".
- Prod is changed only by the user, in the SQL Editor, with authorization. Test migrations: try `apply_migration`; if declined, the user runs the SQL in the Test SQL Editor.
- No test framework in the repo: DB behavior is tested with a SQL script run against Ruiz_Test (`inrzrgpijfdcngwihfme`) inside `BEGIN … ROLLBACK`; UI with `npx tsc -b`, `npx vite build`, ESLint (no new errors vs main) and manual checks in the Vercel preview.

## Review Focus

- **Cancel succeeds but the decision call fails** (network, permission): the sale stays cancelled and the pending notice must appear on reload so it can be decided. → Task 3 manual check "fallo al decidir".
- **A role without permission opens a cancelled sale with saldo**: sees the notice without buttons; the RPC rejects a direct call. → Task 1 test `sin_permiso`, Task 3 manual check.
- **Sale with the 20% refund and the saldo refund**: both devoluciones visible; the "cancelada sin devolución" message must not appear when only the saldo refund exists. → Task 3 manual check "dos devoluciones".
- **Editing or cancelling an old payment of a cancelled sale**: must still work; only raising `saldo_favor_aplicado` is blocked. → Task 1 tests `trigger_permite_cancelar_pago`, `trigger_bloquea_saldo_nuevo`.
- **Double click / two staff deciding at once**: the second call fails cleanly ("ya tiene una decisión"), no duplicate devolución. → Task 1 test `decidir_dos_veces` (UNIQUE + row lock).

---

### Task 1: Database — table, functions, trigger and SQL tests

**Files:**
- Create: `supabase/migrations/20261112150000_saldo_favor_cierres.sql`
- Create: `supabase/tests/saldo_favor_cierres_test.sql`

**Interfaces:**
- Produces:
  - Table `public.saldo_favor_cierres(cierreid bigint identity PK, ventaid integer NOT NULL UNIQUE REFERENCES venta, monto numeric(12,2) NOT NULL CHECK (monto > 0), decision text NOT NULL CHECK (decision IN ('reembolso','retencion')), devolucionid integer NULL REFERENCES devoluciones, nota text NULL, created_by uuid NOT NULL, created_by_nombre text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())` with `CHECK ((decision = 'reembolso') = (devolucionid IS NOT NULL))`.
  - `public.saldo_favor_venta(p_ventaid integer) RETURNS numeric` — STABLE, SECURITY DEFINER; the balance per Global Constraints, rounded to 2 decimals, never below 0.
  - `public.cerrar_saldo_favor(p_ventaid integer, p_decision text, p_nota text DEFAULT NULL) RETURNS TABLE (cierreid bigint, monto numeric, devolucionid integer)` — SECURITY DEFINER, `search_path = public`.
  - Trigger `pagos_no_saldo_en_venta_cancelada` (BEFORE INSERT OR UPDATE on `pagos`).

- [ ] **Step 1: Write the SQL test script** `supabase/tests/saldo_favor_cierres_test.sql`

  One `BEGIN; … ROLLBACK;` script that returns one row per check `(prueba text, ok boolean, detalle text)` via a temp table `resultados`. Setup as `postgres`: pick an active Test sale with ≥ 2 corridas (`v_venta`), insert a payment with `servicios_extra = 300` on one of its corridas, set the sale `estatus = 'C'`; pick a second cancelled-able sale without saldo (`v_sin_saldo`); pick an `admin` user id and a `vendedor` user id from `user_roles`. Impersonate with `set local role authenticated` + `set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'role','authenticated','user_metadata', json_build_object('nombre','Prueba','apellido','Saldo'))::text, true)`; reset to `postgres` between checks with `reset role`. Wrap each expected failure in a `DO` block that catches the exception and inserts `ok = (SQLERRM LIKE '<texto>%')`.

  Checks (names are the `prueba` values):
  - `saldo_calculado`: `saldo_favor_venta(v_venta) = 300` (plus whatever saldo the sale already had — read it before inserting and assert `= antes + 300`).
  - `sin_permiso`: as `vendedor`, `cerrar_saldo_favor(v_venta,'retencion')` fails with `No tienes permiso`.
  - `venta_activa`: as admin, on an active sale fails with `La venta no está cancelada`.
  - `sin_saldo`: as admin, on `v_sin_saldo` (cancelled in setup) fails with `La venta no tiene saldo a favor`.
  - `decision_invalida`: `p_decision = 'otro'` fails with `Decisión inválida`.
  - `reembolso`: as admin, `cerrar_saldo_favor(v_venta,'reembolso','prueba')` returns `monto = saldo`; a `devoluciones` row exists with that `devolucionid`, `monto_total = monto`, `motivo = 'Reembolso de saldo a favor'`, `estatus = 'P'`, and exactly 1 `devolucion_parcialidades` row with `monto = monto`; the cierre has `created_by_nombre = 'Prueba Saldo'`.
  - `decidir_dos_veces`: a second call on `v_venta` fails with `La venta ya tiene una decisión`.
  - `retencion` (separate savepoint/sale state: undo the reembolso by deleting as postgres, then call with `'retencion'`): cierre with `devolucionid IS NULL`, no new devolución.
  - `trigger_bloquea_saldo_nuevo`: as postgres, inserting a payment with `saldo_favor_aplicado = 50` on a corrida of `v_venta` fails with `No se puede usar saldo a favor de una venta cancelada`.
  - `trigger_permite_cancelar_pago`: updating the setup payment to `estatus = 'C'` succeeds.
  - `rls_lectura`: as `vendedor`, `select count(*) from saldo_favor_cierres where ventaid = v_venta` = 1; `insert` into the table directly fails (no policy).

  Last statement: `select * from resultados order by prueba;` then `ROLLBACK;`.

- [ ] **Step 2: Run the test against Ruiz_Test to verify it fails**

  Run the script with `mcp__claude_ai_Supabase__execute_sql` on `inrzrgpijfdcngwihfme`.
  Expected: error `function public.saldo_favor_venta(integer) does not exist` (nothing created yet).

- [ ] **Step 3: Write the migration** `supabase/migrations/20261112150000_saldo_favor_cierres.sql`

  Contents, in order: the table (constraints above); `ENABLE ROW LEVEL SECURITY`; one SELECT policy `saldo_favor_cierres_select_panel` for the read roles (same expression style as `devoluciones_panel_all`: `(SELECT public.has_admin_panel_role(ARRAY[...]))`); `saldo_favor_venta`; `cerrar_saldo_favor`; the trigger function `pagos_no_saldo_en_venta_cancelada()` and trigger; `REVOKE EXECUTE … FROM PUBLIC, anon` and `GRANT EXECUTE … TO authenticated` for `saldo_favor_venta` and `cerrar_saldo_favor`; `REVOKE` all on the trigger function from `PUBLIC, anon, authenticated`. Header comment explains the why (spec "Objetivo").

  `cerrar_saldo_favor` body, in order (error texts are exact; tests match them):
  1. `COALESCE(has_admin_panel_role(ARRAY['admin','finanzas','cobranza_caja','contratos']), false)` else `RAISE EXCEPTION 'No tienes permiso para decidir el saldo a favor' USING ERRCODE = '42501'`.
  2. `p_decision NOT IN ('reembolso','retencion')` → `'Decisión inválida'`.
  3. `SELECT … FROM venta WHERE ventaid = p_ventaid FOR UPDATE`; not found → `'La venta no existe'`; `estatus <> 'C'` → `'La venta no está cancelada'`.
  4. Existing cierre → `'La venta ya tiene una decisión de saldo a favor'`.
  5. `v_monto := saldo_favor_venta(p_ventaid)`; `<= 0` → `'La venta no tiene saldo a favor'`.
  6. If `reembolso`: insert `devoluciones (ventaid, clienteid, monto_total, motivo, estatus)` returning id, then one `devolucion_parcialidades (devolucionid, monto, estatus, notas)` with `'P'`, `'Parcialidad 1 de 1'`.
  7. `created_by_nombre := COALESCE(NULLIF(trim(concat_ws(' ', auth.jwt()->'user_metadata'->>'nombre', auth.jwt()->'user_metadata'->>'apellido')), ''), auth.jwt()->>'email', 'Usuario')`.
  8. Insert the cierre with `NULLIF(trim(p_nota), '')`; return the row.

  Trigger rule: raise `'No se puede usar saldo a favor de una venta cancelada'` when `NEW.estatus IS DISTINCT FROM 'C'` and `COALESCE(NEW.saldo_favor_aplicado,0) > (CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.saldo_favor_aplicado,0) ELSE 0 END)` and the sale of `NEW.corridafinancieraid` has `estatus = 'C'`.

- [ ] **Step 4: Apply the migration to Ruiz_Test**

  Try `mcp__claude_ai_Supabase__apply_migration` (name `saldo_favor_cierres`). If declined, give the user the file content to run in the Test SQL Editor and wait.
  Verify: `select to_regclass('public.saldo_favor_cierres'), to_regprocedure('public.cerrar_saldo_favor(integer,text,text)')` both non-null.

- [ ] **Step 5: Run the test script to verify it passes**

  Expected: every row `ok = true` (11 rows). Then confirm nothing persisted: `select count(*) from saldo_favor_cierres` = 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261112150000_saldo_favor_cierres.sql supabase/tests/saldo_favor_cierres_test.sql
git commit -m "feat: record the saldo a favor decision when a sale is cancelled"
```

### Task 2: Client helpers and types

**Files:**
- Modify: `src/types/database.ts` (next to `Devolucion`)
- Modify: `src/utils/pagos.ts`

**Interfaces:**
- Consumes: `cerrar_saldo_favor`, table `saldo_favor_cierres` (Task 1); existing `fetchSaldoFavorDisponible(ventaid: number): Promise<number>`.
- Produces:
  - `export type SaldoFavorDecision = 'reembolso' | 'retencion'`
  - `export type SaldoFavorCierre = { cierreid: number; ventaid: number; monto: number; decision: SaldoFavorDecision; devolucionid: number | null; nota: string | null; created_by: string; created_by_nombre: string; created_at: string }`
  - `export const ROLES_DECIDEN_SALDO_FAVOR: readonly AdminPanelRole[] = ['admin', 'finanzas', 'cobranza_caja', 'contratos']` (in `src/utils/pagos.ts`, importing the type from `@/config/roles`)
  - `export const fetchSaldoFavorCierre = async (ventaid: number): Promise<SaldoFavorCierre | null>` — `maybeSingle()` on `saldo_favor_cierres` by `ventaid`; throws on error.
  - `export const cerrarSaldoFavor = async (ventaid: number, decision: SaldoFavorDecision, nota?: string): Promise<{ cierreid: number; monto: number; devolucionid: number | null }>` — `supabase.rpc('cerrar_saldo_favor', { p_ventaid, p_decision, p_nota: nota ?? null })`; throws `new Error(error.message)` so the DB's Spanish message reaches the UI.

- [ ] **Step 1: Add the types and helpers**
- [ ] **Step 2: Verify** — `npx tsc -b` exits 0.
- [ ] **Step 3: Commit** — `git commit -m "feat: add saldo a favor decision helpers"`

### Task 3: Sale detail UI

**Files:**
- Create: `src/components/SaldoFavorCierre.tsx`
- Modify: `src/pages/admin/VentaDetail.tsx` (devolución state ~L79, load ~L287-293, `handleCancelVenta` ~L477-600, devolución panel ~L1060-1125, cancel modal ~L1647-1757)

**Interfaces:**
- Consumes: Task 2 exports; `useAuth().role`; existing `formatCurrency`, `formatDate`, `Button`.
- Produces (in `SaldoFavorCierre.tsx`):
  - `export function SaldoFavorDecisionFields(props: { monto: number; decision: SaldoFavorDecision | null; nota: string; onChange: (decision: SaldoFavorDecision | null, nota: string) => void; disabled?: boolean })` — the question, two radio options and the note textarea. Used in the cancel modal and in the pending notice.
  - `export function SaldoFavorCierrePanel(props: { ventaid: number; puedeDecidir: boolean; onDecidido: () => void })` — loads `fetchSaldoFavorCierre` and `fetchSaldoFavorDisponible`; renders nothing when there is no cierre and saldo is 0; the decided text when a cierre exists; otherwise the amber pending notice "Saldo a favor pendiente de decidir: $X" with `SaldoFavorDecisionFields` and a "Guardar decisión" button only if `puedeDecidir`. Shows the RPC error message inline on failure.

- [ ] **Step 1: Build `SaldoFavorCierre.tsx`** with the two components above and the exact copy from Global Constraints. Decided text uses `formatDate(created_at)` and, for a refund, `Devolución #${devolucionid}`.

- [ ] **Step 2: Devoluciones as a list in `VentaDetail.tsx`**
  - State `devoluciones: (Devolucion & { parcialidades?: DevolucionParcialidad[] })[]` replaces `devolucion`.
  - Both loads (~L289 and ~L596) drop `.maybeSingle()`, add `.order('devolucionid')`, and set the array.
  - The panel maps over the array (one card per devolución, current markup unchanged inside; title "Devolución registrada" + `#devolucionid`).
  - The "cancelada sin devolución (menos del 20%)" message shows only when no devolución has a `motivo` other than `'Reembolso de saldo a favor'`.
  - In `handleCancelVenta`, drop the optimistic `setDevolucion(...)` (the refetch at the end loads the list).

- [ ] **Step 3: Cancel dialog**
  - When the modal opens, load `fetchSaldoFavorDisponible(venta.ventaid)` into `saldoCancelacion` (state, `number | null`), and reset `decisionSaldo`/`notaSaldo`.
  - If `saldoCancelacion > 0`, render `SaldoFavorDecisionFields` above the confirmation text; if the user can't decide (`!ROLES_DECIDEN_SALDO_FAVOR.includes(role)`), render instead a note "La decisión sobre el saldo a favor la toma Finanzas o Caja después de cancelar." and do not block.
  - "Sí, cancelar venta" is disabled while `saldoCancelacion === null` (loading) or when the user can decide, `saldoCancelacion > 0` and `decisionSaldo === null`.
  - In `handleCancelVenta`, after the venta update and lote release and before Quentli, if a decision was chosen: `await cerrarSaldoFavor(venta.ventaid, decisionSaldo, notaSaldo)` inside its own try/catch; on failure `alert('La venta se canceló, pero no se registró la decisión del saldo a favor: ' + message + '. Puedes decidirla desde el detalle de la venta.')` and continue.

- [ ] **Step 4: Pending/decided panel** — render `<SaldoFavorCierrePanel ventaid={venta.ventaid} puedeDecidir={…} onDecidido={reloadDevoluciones} />` when `venta.estatus === 'C'`, right above the devoluciones panel. `reloadDevoluciones` re-runs the devoluciones query. Also re-run it after `handleCancelVenta`.

- [ ] **Step 5: Verify build** — `npx tsc -b` exits 0; `npx vite build` prints `built in`; `npx eslint src/components/SaldoFavorCierre.tsx src/pages/admin/VentaDetail.tsx` has no more errors than the same files on `origin/main` (compare counts with `git show origin/main:<file> | npx eslint --stdin --stdin-filename <file>`).

- [ ] **Step 6: Commit** — `git commit -m "feat: ask what happens to saldo a favor when cancelling a sale"`

- [ ] **Step 7: Manual checks in the Vercel preview (Test data)** — push the branch, open the preview, and with an admin user:
  - "reembolsar": cancel a sale that has saldo, choose Reembolsar → the sale shows "Saldo a favor de $X: reembolsado (Devolución #N)" and a devolución card for $X with one parcialidad.
  - "retener": same with Retener → "retenido por <tu nombre> el <fecha>", no new devolución.
  - "sin saldo": cancel a sale without saldo → dialog has no saldo question; behaves as before.
  - "dos devoluciones": a sale with > 20% paid and saldo → two devolución cards; no "sin devolución" message.
  - "pendiente": in SQL (Test), cancel a sale with saldo directly (`update venta set estatus='C'`) → its detail shows the pending notice; decide from there.
  - "fallo al decidir": with the network tab set offline right before confirming (or by temporarily revoking EXECUTE in Test), the sale cancels, the alert appears, and on reload the pending notice is there.
  - With a `vendedor` user: the pending notice shows without buttons.
  Then clean up the Test sales used (reactivate or leave cancelled, as the user prefers).

### Task 4: Pull request and Prod rollout

**Files:** none new.

- [ ] **Step 1: Open the PR** to `main` with `gh pr create` (body in Spanish: qué cambia, migración a correr en Prod antes de fusionar, pruebas hechas, y la venta cancelada de $200 que hay que resolver después). End with the Claude Code line.
- [ ] **Step 2: Give the user the migration SQL** for the Prod SQL Editor; after they run it, verify read-only in Prod: table, both functions, trigger, policy exist and `has_function_privilege('anon', 'public.cerrar_saldo_favor(integer,text,text)', 'execute')` is false.
- [ ] **Step 3: After the user merges**, confirm the Vercel production deployment of the merge commit succeeded, remove the worktree, and update memory `saldo-favor-guardadito` (step 2 done; the $200 sale pending for administration).
