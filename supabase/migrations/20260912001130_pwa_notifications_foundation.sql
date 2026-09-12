-- PROPOSED / NOT APPLIED. Explicit schema approval is required.
-- Apply this complete file in ONE transaction after catalog/drift review.
-- No network call, scheduler, environment value, or booking lifecycle rewrite.
begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null,
  booking_id uuid not null,
  notification_type text not null check (notification_type in (
    'CUSTOMER_CONFIRMED', 'CUSTOMER_FEEDBACK_RECEIVED', 'BOOKING_OVERDUE',
    'AMENDMENT_RESPONDED', 'ADD_ON_RESPONDED'
  )),
  event_id uuid not null,
  dedupe_key text generated always as (notification_type || ':' || event_id::text) stored,
  created_at timestamptz not null default now(),
  read_at timestamptz check (read_at is null or read_at >= created_at),
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id) on delete cascade,
  unique (user_id, dedupe_key),
  unique (id, user_id)
);
create index notifications_user_history_idx on public.notifications(user_id, created_at desc, id desc);
create index notifications_user_unread_idx on public.notifications(user_id, business_id) where read_at is null;
create index notifications_booking_idx on public.notifications(business_id, booking_id);
create index notifications_retention_idx on public.notifications(created_at);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_confirmations boolean not null default true,
  customer_feedback boolean not null default true,
  overdue_bookings boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (
    octet_length(endpoint) between 25 and 2048
    and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])*push[.]apple[.]com)/[A-Za-z0-9_/?=&%:+.~-]+$'
  ),
  endpoint_hash text generated always as
    (encode(extensions.digest(endpoint, 'sha256'), 'hex')) stored unique,
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth_key text not null check (auth_key ~ '^[A-Za-z0-9_-]{22}$'),
  generation uuid not null default gen_random_uuid(),
  platform text not null default 'web' check (platform in ('web', 'ios', 'android', 'desktop')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (id, user_id)
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index push_subscriptions_retention_idx on public.push_subscriptions(last_seen_at);
create index push_subscriptions_revoked_idx on public.push_subscriptions(revoked_at) where revoked_at is not null;

-- One record per notification/device is necessary for independent bounded retries.
-- No copies of payloads, endpoints, keys, customer data, or provider error bodies.
create table private.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  notification_id uuid not null,
  subscription_id uuid not null,
  subscription_generation uuid not null,
  state text not null default 'pending' check (state in
    ('pending', 'sending', 'accepted', 'invalid', 'failed', 'unknown', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  last_http_status integer check (last_http_status between 100 and 599),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  foreign key (notification_id, user_id) references public.notifications(id, user_id) on delete cascade,
  foreign key (subscription_id, user_id) references public.push_subscriptions(id, user_id) on delete cascade,
  unique (notification_id, subscription_id),
  check ((state = 'sending') = (lease_token is not null and lease_expires_at is not null))
);
create index notification_push_pending_idx on private.notification_push_deliveries(next_attempt_at, id) where state = 'pending';
create index notification_push_lease_idx on private.notification_push_deliveries(lease_expires_at) where state = 'sending';
create index notification_push_subscription_idx on private.notification_push_deliveries(subscription_id, user_id);
create index notification_push_retention_idx on private.notification_push_deliveries(created_at);

-- Retention must not make a still-overdue booking eligible again. This compact
-- receipt lasts only as long as its booking; it contains no notification history.
create table private.notification_overdue_receipts (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  recorded_at timestamptz not null default now()
);

-- Existing schedule indexes all start with business_id; this worker scans across
-- businesses. A narrow partial index supports its timestamp order and predicate.
create index bookings_notification_due_idx on public.bookings(scheduled_for, id)
  where scheduled_for is not null and status not in ('DELIVERED', 'COMPLETED', 'CANCELLED');

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table private.notification_push_deliveries enable row level security;
alter table private.notification_overdue_receipts enable row level security;

revoke all on public.notifications, public.notification_preferences, public.push_subscriptions
  from public, anon, authenticated, service_role;
revoke all on private.notification_push_deliveries, private.notification_overdue_receipts
  from public, anon, authenticated, service_role;

create function private.notification_user_enabled(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = p_user_id
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now()));
$$;

create function private.notification_recipient_allowed(p_user_id uuid, p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.notification_user_enabled(p_user_id) and exists (
    select 1 from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = p_business_id and m.user_id = p_user_id
      and m.status = 'active' and m.role in ('owner', 'member')
      and b.onboarding_completed_at is not null
      and b.onboarding_completed_at <> 'epoch'::timestamptz
  );
$$;

-- Self-scoped helpers are the only private helpers executable by authenticated.
create function private.notification_current_user_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.notification_user_enabled(auth.uid());
$$;
create function private.notification_current_user_can_read(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.notification_recipient_allowed(auth.uid(), p_business_id);
$$;

create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and private.notification_current_user_can_read(business_id));
create policy notifications_mark_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and private.notification_current_user_can_read(business_id))
  with check (user_id = (select auth.uid()) and private.notification_current_user_can_read(business_id));
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy notification_preferences_read_own on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()) and (select private.notification_current_user_enabled()));
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.notification_current_user_enabled()));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid()) and (select private.notification_current_user_enabled()))
  with check (user_id = (select auth.uid()) and (select private.notification_current_user_enabled()));
grant select, insert on public.notification_preferences to authenticated;
grant update(customer_confirmations, customer_feedback, overdue_bookings) on public.notification_preferences to authenticated;
create trigger notification_preferences_updated before update on public.notification_preferences
  for each row execute function private.set_updated_at();

create policy push_subscriptions_read_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) and (select private.notification_current_user_enabled()));
-- Endpoint/encryption keys never appear in account-list responses.
grant select(id, user_id, platform, created_at, last_seen_at, revoked_at) on public.push_subscriptions to authenticated;

create function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth_key text, p_platform text default 'web'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_existing public.push_subscriptions;
  v_id uuid;
begin
  if v_user is null or not private.notification_user_enabled(v_user) then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  -- Serialize the per-account quota without any session-level lock.
  perform pg_advisory_xact_lock(hashtextextended('push-subscriptions:' || v_user::text, 0));
  select * into v_existing from public.push_subscriptions s
    where s.endpoint_hash = encode(extensions.digest(p_endpoint, 'sha256'), 'hex') for update;
  if found and v_existing.user_id <> v_user then
    raise exception 'subscription_unavailable' using errcode = '42501';
  end if;
  if v_existing.id is null and (select count(*) from public.push_subscriptions s where s.user_id = v_user) >= 20 then
    raise exception 'subscription_limit_reached' using errcode = '22023';
  end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth_key, platform)
    values (v_user, p_endpoint, p_p256dh, p_auth_key, p_platform)
  on conflict (endpoint_hash) do update set
    p256dh = excluded.p256dh, auth_key = excluded.auth_key, platform = excluded.platform,
    last_seen_at = now(), revoked_at = null,
    generation = case when push_subscriptions.p256dh <> excluded.p256dh
      or push_subscriptions.auth_key <> excluded.auth_key or push_subscriptions.revoked_at is not null
      then gen_random_uuid() else push_subscriptions.generation end
  where push_subscriptions.user_id = v_user
  returning id into v_id;
  if v_id is null then raise exception 'subscription_unavailable' using errcode = '42501'; end if;
  return v_id;
end;
$$;

create function public.remove_push_subscription(p_subscription_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  delete from public.push_subscriptions where id = p_subscription_id and user_id = auth.uid();
end;
$$;

create function private.notification_push_enabled(p_user_id uuid, p_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select case
    when p_type in ('CUSTOMER_CONFIRMED', 'AMENDMENT_RESPONDED', 'ADD_ON_RESPONDED') then p.customer_confirmations
    when p_type = 'CUSTOMER_FEEDBACK_RECEIVED' then p.customer_feedback
    when p_type = 'BOOKING_OVERDUE' then p.overdue_bookings
    else false end from public.notification_preferences p where p.user_id = p_user_id),
    p_type in ('CUSTOMER_CONFIRMED', 'CUSTOMER_FEEDBACK_RECEIVED', 'BOOKING_OVERDUE', 'AMENDMENT_RESPONDED', 'ADD_ON_RESPONDED'));
$$;

create function private.emit_booking_notification(p_business_id uuid, p_booking_id uuid, p_type text, p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member record; v_notification uuid;
begin
  for v_member in select m.user_id from public.business_members m
    where m.business_id = p_business_id and private.notification_recipient_allowed(m.user_id, p_business_id)
  loop
    v_notification := null;
    insert into public.notifications(user_id, business_id, booking_id, notification_type, event_id)
      values (v_member.user_id, p_business_id, p_booking_id, p_type, p_event_id)
      on conflict (user_id, dedupe_key) do nothing returning id into v_notification;
    if v_notification is not null and private.notification_push_enabled(v_member.user_id, p_type) then
      insert into private.notification_push_deliveries(user_id, notification_id, subscription_id, subscription_generation)
        select v_member.user_id, v_notification, s.id, s.generation from public.push_subscriptions s
        where s.user_id = v_member.user_id and s.revoked_at is null
          and s.last_seen_at > now() - interval '180 days'
        on conflict (notification_id, subscription_id) do nothing;
    end if;
  end loop;
end;
$$;

create function private.capture_booking_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'booking_confirmations' then
    perform private.emit_booking_notification(new.business_id, new.booking_id, 'CUSTOMER_CONFIRMED', new.id);
  elsif tg_table_name = 'feedback' then
    perform private.emit_booking_notification(new.business_id, new.booking_id, 'CUSTOMER_FEEDBACK_RECEIVED', new.id);
  elsif tg_table_name = 'booking_amendments' then
    perform private.emit_booking_notification(new.business_id, new.booking_id, 'AMENDMENT_RESPONDED', new.id);
  elsif tg_table_name = 'booking_addons' then
    perform private.emit_booking_notification(new.business_id, new.booking_id, 'ADD_ON_RESPONDED', new.id);
  end if;
  return new;
end;
$$;
create trigger notification_customer_confirmed after insert on public.booking_confirmations
  for each row execute function private.capture_booking_notification();
create trigger notification_feedback_received after insert on public.feedback
  for each row execute function private.capture_booking_notification();
create trigger notification_amendment_responded after update of status on public.booking_amendments
  for each row when (old.status = 'PENDING_CUSTOMER' and new.status = 'CONFIRMED')
  execute function private.capture_booking_notification();
create trigger notification_addon_responded after update of status on public.booking_addons
  for each row when (old.status = 'AWAITING_CUSTOMER' and new.status = 'CONFIRMED')
  execute function private.capture_booking_notification();

create function private.remove_revoked_membership_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications n where n.user_id = old.user_id and n.business_id = old.business_id;
  return old;
end;
$$;
create trigger notification_membership_removed after delete on public.business_members
  for each row execute function private.remove_revoked_membership_notifications();

-- Suppress rollout backlog. No historical confirmation/feedback backfill.
-- Predicate is identical to Dashboard/Bookings: includes DRAFT/AWAITING_CUSTOMER.
insert into private.notification_overdue_receipts(booking_id)
  select b.id from public.bookings b where b.scheduled_for < now()
    and b.status not in ('DELIVERED', 'COMPLETED', 'CANCELLED');

create function public.process_overdue_notifications(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_booking record; v_receipt uuid; v_count integer := 0;
begin
  for v_booking in select b.id, b.business_id from public.bookings b
    where b.scheduled_for < now() and b.status not in ('DELIVERED', 'COMPLETED', 'CANCELLED')
      and not exists (select 1 from private.notification_overdue_receipts r where r.booking_id = b.id)
    order by b.scheduled_for, b.id limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update of b skip locked
  loop
    v_receipt := null;
    insert into private.notification_overdue_receipts(booking_id) values (v_booking.id)
      on conflict (booking_id) do nothing returning booking_id into v_receipt;
    if v_receipt is not null then
      perform private.emit_booking_notification(v_booking.business_id, v_booking.id, 'BOOKING_OVERDUE', v_booking.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.claim_notification_push(p_limit integer default 20)
returns table(delivery_id uuid, lease_token uuid, notification_id uuid, notification_type text,
  business_id uuid, booking_id uuid, endpoint text, p256dh text, auth_key text, unread_count bigint)
language plpgsql security definer set search_path = '' as $$
begin
  -- A crashed sender has an ambiguous provider outcome. Never resend it blindly.
  update private.notification_push_deliveries d set state = 'unknown', lease_token = null, lease_expires_at = null
    where d.state = 'sending' and d.lease_expires_at <= now();
  update private.notification_push_deliveries d set state = 'skipped'
    where d.state = 'pending' and (d.expires_at <= now() or d.attempt_count >= 3
      or not exists (
        select 1 from public.notifications n join public.push_subscriptions s on s.id = d.subscription_id
        where n.id = d.notification_id and n.user_id = s.user_id and n.read_at is null
          and s.revoked_at is null and s.generation = d.subscription_generation
          and s.last_seen_at > now() - interval '180 days'
          and private.notification_recipient_allowed(n.user_id, n.business_id)
          and private.notification_push_enabled(n.user_id, n.notification_type)
      ));
  return query with candidates as (
    select d.id from private.notification_push_deliveries d
    where d.state = 'pending' and d.next_attempt_at <= now()
    order by d.next_attempt_at, d.id limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  ), claimed as (
    update private.notification_push_deliveries d set state = 'sending', attempt_count = d.attempt_count + 1,
      last_attempt_at = now(), lease_token = gen_random_uuid(), lease_expires_at = now() + interval '2 minutes'
    from candidates c where d.id = c.id returning d.*
  ) select c.id, c.lease_token, n.id, n.notification_type, n.business_id, n.booking_id,
      s.endpoint, s.p256dh, s.auth_key,
      (select count(*) from public.notifications unread where unread.user_id = n.user_id
        and unread.read_at is null and private.notification_recipient_allowed(unread.user_id, unread.business_id))
    from claimed c join public.notifications n on n.id = c.notification_id
      join public.push_subscriptions s on s.id = c.subscription_id;
end;
$$;

create function public.finish_notification_push(
  p_delivery_id uuid, p_lease_token uuid, p_http_status integer default null,
  p_retry_after_seconds integer default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_delivery private.notification_push_deliveries; v_state text; v_delay integer;
begin
  if p_http_status is not null and p_http_status not between 100 and 599 then
    raise exception 'invalid_http_status' using errcode = '22023';
  end if;
  select * into v_delivery from private.notification_push_deliveries d
    where d.id = p_delivery_id and d.state = 'sending' and d.lease_token = p_lease_token
      and d.lease_expires_at > now() for update;
  if not found then return false; end if;
  v_state := case
    when p_http_status between 200 and 299 then 'accepted'
    when p_http_status in (404, 410) then 'invalid'
    when (p_http_status = 429 or p_http_status between 500 and 599)
      and v_delivery.attempt_count < 3 and v_delivery.expires_at > now() then 'pending'
    when p_http_status is null then 'unknown'
    else 'failed' end;
  -- Never retry before a provider's longer Retry-After; abandon beyond our bound.
  if v_state = 'pending' and p_retry_after_seconds > 3600 then v_state := 'failed'; end if;
  v_delay := greatest(coalesce(p_retry_after_seconds, 0), case when v_delivery.attempt_count = 1 then 60 else 300 end);
  if v_state = 'pending' and now() + make_interval(secs => v_delay) >= v_delivery.expires_at then
    v_state := 'failed';
  end if;
  update private.notification_push_deliveries d set state = v_state, last_http_status = p_http_status,
    next_attempt_at = case when v_state = 'pending' then now() + make_interval(secs => v_delay) else d.next_attempt_at end,
    accepted_at = case when v_state = 'accepted' then now() else null end,
    lease_token = null, lease_expires_at = null where d.id = v_delivery.id;
  if v_state = 'invalid' then
    update public.push_subscriptions s set revoked_at = now()
      where s.id = v_delivery.subscription_id and s.generation = v_delivery.subscription_generation;
  end if;
  return true;
end;
$$;

create function public.maintain_notifications(p_limit integer default 1000)
returns void language plpgsql security definer set search_path = '' as $$
declare v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 5000));
begin
  delete from private.notification_push_deliveries where id in (
    select id from private.notification_push_deliveries where created_at < now() - interval '7 days'
    order by created_at limit v_limit);
  delete from public.notifications where id in (
    select id from public.notifications where created_at < now() - interval '90 days'
    order by created_at limit v_limit);
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

-- Explicit ownership and function ACLs: private code is not an exposed API.
alter table public.notifications owner to postgres;
alter table public.notification_preferences owner to postgres;
alter table public.push_subscriptions owner to postgres;
alter table private.notification_push_deliveries owner to postgres;
alter table private.notification_overdue_receipts owner to postgres;

do $$
declare v_function regprocedure;
begin
  foreach v_function in array array[
    'private.notification_user_enabled(uuid)'::regprocedure,
    'private.notification_recipient_allowed(uuid,uuid)'::regprocedure,
    'private.notification_current_user_enabled()'::regprocedure,
    'private.notification_current_user_can_read(uuid)'::regprocedure,
    'private.notification_push_enabled(uuid,text)'::regprocedure,
    'private.emit_booking_notification(uuid,uuid,text,uuid)'::regprocedure,
    'private.capture_booking_notification()'::regprocedure,
    'private.remove_revoked_membership_notifications()'::regprocedure,
    'public.register_push_subscription(text,text,text,text)'::regprocedure,
    'public.remove_push_subscription(uuid)'::regprocedure,
    'public.process_overdue_notifications(integer)'::regprocedure,
    'public.claim_notification_push(integer)'::regprocedure,
    'public.finish_notification_push(uuid,uuid,integer,integer)'::regprocedure,
    'public.maintain_notifications(integer)'::regprocedure
  ] loop
    execute format('alter function %s owner to postgres', v_function);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_function);
  end loop;
end;
$$;
grant execute on function private.notification_current_user_enabled(),
  private.notification_current_user_can_read(uuid),
  public.register_push_subscription(text,text,text,text),
  public.remove_push_subscription(uuid) to authenticated;
grant execute on function public.process_overdue_notifications(integer),
  public.claim_notification_push(integer), public.finish_notification_push(uuid,uuid,integer,integer),
  public.maintain_notifications(integer) to service_role;

comment on table public.notifications is
  'Durable authenticated operational events. Push is optional best-effort transport; no customer PII or capabilities.';
comment on table private.notification_overdue_receipts is
  'One receipt per booking lifetime prevents repeat overdue alerts after notification history retention.';
comment on table private.notification_push_deliveries is
  'Provider handoff evidence only, not device-delivery proof. Ambiguous outcomes are terminal, not automatically resent.';

commit;
