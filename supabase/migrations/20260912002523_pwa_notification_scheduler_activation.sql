-- PROPOSED / NOT APPLIED. Separate recurring-infrastructure approval required.
-- Do not run automatically with the foundation migration. Apply only AFTER the
-- authenticated Production worker is deployed, tested, and its dedicated secret
-- exists in Vercel and Vault. This adds 1,440 scheduled requests/day.
begin;

-- Versions verified available in the target catalog on 2026-09-12.
create extension pg_cron with schema pg_catalog version '1.6.4';
create extension pg_net with schema extensions version '0.20.4';

-- Extensions are absent at preflight. An existing extension fails above so its
-- consumers/ACLs receive a drift review rather than an unexamined permission change.
revoke all on schema net from public, anon, authenticated, service_role;
revoke all on all tables in schema net from public, anon, authenticated, service_role;
revoke all on all sequences in schema net from public, anon, authenticated, service_role;
revoke all on all functions in schema net from public, anon, authenticated, service_role;

do $$
begin
  if to_regprocedure('public.claim_notification_push(integer)') is null then
    raise exception 'notification_foundation_required';
  end if;
  if (select count(*) from vault.decrypted_secrets
      where name = 'notification_worker_secret' and length(decrypted_secret) >= 32) <> 1 then
    raise exception 'notification_worker_secret_required';
  end if;
end;
$$;

create function private.invoke_notification_worker()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_secret text; v_request_id bigint;
begin
  select decrypted_secret into strict v_secret from vault.decrypted_secrets
    where name = 'notification_worker_secret' and length(decrypted_secret) >= 32;
  select net.http_post(
    url := 'https://mykustomers.com/api/internal/notifications/process',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;
  -- Keep only this job's recent operational history; never log request headers.
  delete from cron.job_run_details where jobid in
    (select jobid from cron.job where jobname = 'myk-notifications')
    and end_time < now() - interval '7 days';
  return v_request_id;
end;
$$;
alter function private.invoke_notification_worker() owner to postgres;
revoke all on function private.invoke_notification_worker() from public, anon, authenticated, service_role;

select cron.schedule('myk-notifications', '* * * * *', 'select private.invoke_notification_worker();');

commit;
