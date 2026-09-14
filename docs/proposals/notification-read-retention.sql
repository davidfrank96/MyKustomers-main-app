-- PROPOSAL ONLY: requires explicit approval before any Production application.
-- No table/column, grant, RLS, scheduler, cadence, worker or provider changes.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

create index notifications_read_retention_idx
  on public.notifications(read_at, id) where read_at is not null;

create or replace function public.maintain_notifications(p_limit integer default 1000)
returns void language plpgsql security definer set search_path = '' as $$
declare v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 5000));
begin
  delete from private.notification_push_deliveries where id in (
    select id from private.notification_push_deliveries where created_at < now() - interval '7 days'
    order by created_at limit v_limit);
  delete from public.notifications where id in (
    select id from public.notifications where read_at < now() - interval '72 hours'
    order by read_at, id limit v_limit);
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where revoked_at < now() - interval '30 days'
      or last_seen_at < now() - interval '180 days'
    order by last_seen_at limit v_limit);
  -- Membership deletion must remove stale authority/history; rejoining must not
  -- restore old unread records. This also catches disabled/deleted accounts.
  delete from public.notifications where id in (
    select id from public.notifications n where not private.notification_recipient_allowed(n.user_id, n.business_id)
    order by created_at limit v_limit);
end;
$$;

commit;
