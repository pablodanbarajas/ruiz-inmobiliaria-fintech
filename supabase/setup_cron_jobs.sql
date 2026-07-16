-- ============================================================
-- SETUP DE CRON JOBS — Expiración automática de reservas y enganche
--
-- Ejecutar una sola vez en Supabase SQL Editor.
--
-- Prerequisito: tener la extensión pg_cron activa.
--   Dashboard → Database → Extensions → pg_cron → Enable
-- ============================================================

-- 1. Habilitar pg_cron (si aún no está activa)
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- Job 1: expire_reservations — cada hora
-- Libera lotes cuyo apartado (24h) no fue pagado.
-- ============================================================
SELECT cron.schedule(
  'expire-reservations-hourly',
  '0 * * * *',
  $$SELECT public.expire_reservations();$$
);

-- ============================================================
-- Job 2: expire_enganche — una vez al día a las 01:00 AM
-- Libera lotes cuyo enganche (15 días) no fue pagado.
-- ============================================================
SELECT cron.schedule(
  'expire-enganche-daily',
  '0 1 * * *',
  $$SELECT public.expire_enganche();$$
);

-- ============================================================
-- Verificar que los jobs quedaron registrados
-- ============================================================
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname IN ('expire-reservations-hourly', 'expire-enganche-daily');
