-- sync-quentli-invoices-daily had the service role key written in its
-- command. It now sends a dedicated secret read from Vault at run time.
--
-- Before running this in a project:
--   1. Create the Vault secret (the database generates it; nobody sees it):
--        SELECT vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
--          'sync_quentli_cron_secret',
--          'Bearer token pg_cron sends to sync-quentli-invoices; must equal the function secret CRON_SECRET');
--   2. Copy it from Dashboard → Vault into Edge Functions → Secrets as CRON_SECRET.
--   3. Deploy sync-quentli-invoices with verify_jwt = false (see config.toml).
-- Then rotate the service role key, since it sat in plain text.

DO $$
DECLARE
  job_url text;
BEGIN
  -- Keep each project's own function URL instead of hard-coding it here.
  SELECT substring(command FROM 'url\s*:=\s*''([^'']+)''') INTO job_url
  FROM cron.job WHERE jobname = 'sync-quentli-invoices-daily';

  IF job_url IS NULL THEN
    RAISE EXCEPTION 'sync-quentli-invoices-daily not found or its URL could not be read';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'sync_quentli_cron_secret') THEN
    RAISE EXCEPTION 'Create the Vault secret sync_quentli_cron_secret first (see the header of this file)';
  END IF;

  PERFORM cron.alter_job(
    job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-quentli-invoices-daily'),
    command := format($cmd$
  -- The bearer token lives in Vault (sync_quentli_cron_secret) and must equal
  -- the function secret CRON_SECRET. Never write keys in this command.
  SELECT net.http_post(
    url     := %L,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_quentli_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  $cmd$, job_url)
  );
END $$;
