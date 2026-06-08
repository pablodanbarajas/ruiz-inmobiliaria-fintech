-- Prioridad alta pendiente: Convenios con plan de pago completo
-- Agrega campos para modelar:
-- - Deuda atrasada negociada
-- - Meses para liquidar el atraso
-- - Cuota mensual de convenio
-- - Mensualidad corriente y pago mensual objetivo
-- - Fecha fin estimada

begin;

alter table public.convenios
  add column if not exists deuda_mensualidades numeric(12,2),
  add column if not exists deuda_total_convenio numeric(12,2),
  add column if not exists meses_convenio integer,
  add column if not exists monto_convenio_mensual numeric(12,2),
  add column if not exists mensualidad_corriente numeric(12,2),
  add column if not exists pago_total_mensual_objetivo numeric(12,2),
  add column if not exists fecha_fin_estimada date;

-- Backfill suave para registros existentes
update public.convenios
set meses_convenio = coalesce(meses_convenio, greatest(1, coalesce(meses_atraso, 1)))
where meses_convenio is null;

update public.convenios
set deuda_mensualidades = coalesce(deuda_mensualidades, 0)
where deuda_mensualidades is null;

update public.convenios
set deuda_total_convenio = coalesce(deuda_total_convenio, coalesce(deuda_mensualidades, 0) + coalesce(recargo_acordado, 0))
where deuda_total_convenio is null;

update public.convenios
set monto_convenio_mensual = coalesce(
  monto_convenio_mensual,
  case
    when coalesce(meses_convenio, 0) > 0 then round((coalesce(deuda_total_convenio, 0) / meses_convenio)::numeric, 2)
    else 0
  end
)
where monto_convenio_mensual is null;

update public.convenios
set mensualidad_corriente = coalesce(mensualidad_corriente, 0)
where mensualidad_corriente is null;

update public.convenios
set pago_total_mensual_objetivo = coalesce(pago_total_mensual_objetivo, coalesce(mensualidad_corriente, 0) + coalesce(monto_convenio_mensual, 0))
where pago_total_mensual_objetivo is null;

update public.convenios
set fecha_fin_estimada = coalesce(
  fecha_fin_estimada,
  case
    when fecha is not null and coalesce(meses_convenio, 0) > 0
      then (fecha + ((meses_convenio - 1) * interval '1 month'))::date
    else null
  end
)
where fecha_fin_estimada is null;

-- Constraints de sanidad
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'convenios_meses_convenio_check') then
    alter table public.convenios
      add constraint convenios_meses_convenio_check
      check (meses_convenio is null or meses_convenio >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'convenios_deuda_mensualidades_check') then
    alter table public.convenios
      add constraint convenios_deuda_mensualidades_check
      check (deuda_mensualidades is null or deuda_mensualidades >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'convenios_deuda_total_check') then
    alter table public.convenios
      add constraint convenios_deuda_total_check
      check (deuda_total_convenio is null or deuda_total_convenio >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'convenios_monto_mensual_check') then
    alter table public.convenios
      add constraint convenios_monto_mensual_check
      check (monto_convenio_mensual is null or monto_convenio_mensual >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'convenios_pago_total_objetivo_check') then
    alter table public.convenios
      add constraint convenios_pago_total_objetivo_check
      check (pago_total_mensual_objetivo is null or pago_total_mensual_objetivo >= 0);
  end if;
end $$;

commit;
