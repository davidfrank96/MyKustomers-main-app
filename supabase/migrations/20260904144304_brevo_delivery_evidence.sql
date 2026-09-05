-- EMAIL RELIABILITY PHASE 2B — APPROVAL-ONLY DRAFT. NOT APPLIED.
-- Additive evidence only: never update outbox, attempts, bookings or capabilities.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $precheck$
begin
  if current_user <> 'postgres' then
    raise exception 'provider_evidence_postgres_owner_required';
  end if;
  if to_regclass('public.email_events') is null
    or to_regclass('public.email_delivery_attempts') is null
    or to_regprocedure('extensions.digest(text,text)') is null
    or to_regprocedure('private.require_platform_admin_read_access()') is null
    or to_regprocedure('private.is_business_member(uuid)') is null then
    raise exception 'provider_evidence_dependency_missing';
  end if;
end;
$precheck$;

-- Brevo returns angle-bracket IDs in send responses and bare IDs in callbacks.
-- Remove only a complete outer pair; preserve identifier case and all other bytes.
create function private.brevo_message_key(p_message_id text)
returns text language sql immutable strict set search_path = ''
as $$
  select case
    when char_length(p_message_id) between 1 and 255
      and p_message_id ~ '^(<[^<>[:space:]]+>|[^<>[:space:]]+)$'
    then encode(extensions.digest(
      case when left(p_message_id, 1) = '<'
        then substring(p_message_id from 2 for char_length(p_message_id) - 2)
        else p_message_id end,
      'sha256'), 'hex')
    else null end;
$$;

-- Future sends: X-Mailin-custom = mk-attempt-v1:<this opaque digest>.
-- This is correlation, NOT webhook authentication and NOT a customer capability.
create function private.brevo_attempt_key(p_attempt_id uuid)
returns text language sql immutable strict set search_path = ''
as $$
  select encode(extensions.digest(
    'brevo-attempt/v1/' || p_attempt_id::text, 'sha256'), 'hex');
$$;

alter function private.brevo_message_key(text) owner to postgres;
alter function private.brevo_attempt_key(uuid) owner to postgres;
revoke all on function private.brevo_message_key(text) from public, anon, authenticated;
revoke all on function private.brevo_attempt_key(uuid) from public, anon, authenticated;
-- Existing service-role attempt writes must be able to maintain expression indexes.
grant usage on schema private to service_role;
grant execute on function private.brevo_message_key(text) to service_role;
grant execute on function private.brevo_attempt_key(uuid) to service_role;

alter table public.email_delivery_attempts
  add constraint email_delivery_attempts_id_event_key unique (id, email_event_id);
create index email_attempts_brevo_message_key_idx
  on public.email_delivery_attempts (private.brevo_message_key(provider_message_id))
  where provider = 'brevo' and provider_message_id is not null;
create index email_attempts_brevo_correlation_key_idx
  on public.email_delivery_attempts (private.brevo_attempt_key(id))
  where provider = 'brevo';
create index email_events_delivery_reporting_created_idx
  on public.email_events (created_at, id);

create table public.email_provider_events (
  id uuid primary key default gen_random_uuid(),
  email_event_id uuid not null references public.email_events(id) on delete restrict,
  delivery_attempt_id uuid not null,
  provider text not null default 'brevo' check (provider = 'brevo'),
  message_key text not null check (message_key ~ '^[0-9a-f]{64}$'),
  event_type text not null check (event_type in (
    'DELIVERED', 'DEFERRED', 'SOFT_BOUNCED', 'HARD_BOUNCED',
    'INVALID', 'BLOCKED', 'COMPLAINT', 'PROVIDER_ERROR'
  )),
  provider_event_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  reason_category text not null check (reason_category in (
    'NONE', 'TEMPORARY_DELIVERY_FAILURE', 'PERMANENT_DELIVERY_FAILURE',
    'INVALID_ADDRESS', 'SENDING_BLOCKED', 'COMPLAINT', 'PROVIDER_ERROR'
  )),
  event_fingerprint text not null unique check (event_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint email_provider_events_attempt_event_fk
    foreign key (delivery_attempt_id, email_event_id)
    references public.email_delivery_attempts(id, email_event_id) on delete restrict
);

create index email_provider_events_event_history_idx
  on public.email_provider_events (email_event_id, provider_event_at desc, id desc);
create index email_provider_events_attempt_history_idx
  on public.email_provider_events (delivery_attempt_id, provider_event_at desc, id desc);
create index email_provider_events_message_idx
  on public.email_provider_events (message_key, delivery_attempt_id);

alter table public.email_provider_events owner to postgres;
alter table public.email_provider_events enable row level security;
revoke all on public.email_provider_events from public, anon, authenticated, service_role;
-- No table policies/grants: all reads/writes go through the narrow functions below.

create function private.reject_email_provider_event_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'provider_evidence_is_append_only' using errcode = '42501';
end;
$$;
alter function private.reject_email_provider_event_mutation() owner to postgres;
revoke all on function private.reject_email_provider_event_mutation()
  from public, anon, authenticated, service_role;
create trigger email_provider_events_immutable
  before update or delete on public.email_provider_events
  for each row execute function private.reject_email_provider_event_mutation();
create trigger email_provider_events_no_truncate
  before truncate on public.email_provider_events
  for each statement execute function private.reject_email_provider_event_mutation();

create function public.ingest_brevo_transactional_event(
  p_message_id text,
  p_event_type text,
  p_event_epoch bigint,
  p_correlation_key text default null
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_key text := private.brevo_message_key(p_message_id);
  v_message_ids uuid[];
  v_correlation_ids uuid[];
  v_attempt public.email_delivery_attempts;
  v_attempt_id uuid;
  v_event_id uuid;
  v_fingerprint text;
  v_inserted uuid;
  v_time timestamptz;
  v_reason text;
begin
  -- EXECUTE is service-role-only; no client/recipient/event-id authority exists.
  if v_key is null or p_event_type is null
    or p_event_type not in (
      'DELIVERED', 'DEFERRED', 'SOFT_BOUNCED', 'HARD_BOUNCED',
      'INVALID', 'BLOCKED', 'COMPLAINT', 'PROVIDER_ERROR'
    )
    or p_event_epoch is null or p_event_epoch < 1577836800
    or p_event_epoch > extract(epoch from clock_timestamp())::bigint + 300
    or (p_correlation_key is not null
      and p_correlation_key !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid_provider_evidence' using errcode = '22023';
  end if;
  v_time := to_timestamp(p_event_epoch);
  -- Same message cannot be concurrently assigned to different attempts.
  perform pg_advisory_xact_lock(hashtextextended('brevo/' || v_key, 0));

  select array_agg(candidate.id) into v_message_ids from (
    select attempt.id from public.email_delivery_attempts as attempt
    where attempt.provider = 'brevo'
      and attempt.provider_message_id is not null
      and private.brevo_message_key(attempt.provider_message_id) = v_key
    limit 2
  ) as candidate;
  if coalesce(cardinality(v_message_ids), 0) > 1 then
    return 'CORRELATION_CONFLICT';
  end if;
  v_attempt_id := v_message_ids[1];

  if p_correlation_key is not null then
    select array_agg(candidate.id) into v_correlation_ids from (
      select attempt.id from public.email_delivery_attempts as attempt
      where attempt.provider = 'brevo'
        and private.brevo_attempt_key(attempt.id) = p_correlation_key
      limit 2
    ) as candidate;
    if coalesce(cardinality(v_correlation_ids), 0) <> 1
      or (v_attempt_id is not null and v_attempt_id <> v_correlation_ids[1]) then
      return 'CORRELATION_CONFLICT';
    end if;
    v_attempt_id := v_correlation_ids[1];
  end if;

  if v_attempt_id is null then
    -- Missing legacy IDs can be a short finalization race. Never guess by email.
    return 'UNMATCHED';
  end if;
  select attempt.email_event_id into v_event_id
    from public.email_delivery_attempts as attempt where attempt.id = v_attempt_id;
  -- Match the finalizer's parent-before-attempt lock order, avoiding FK deadlocks.
  perform 1 from public.email_events as event where event.id = v_event_id for key share;
  select * into v_attempt from public.email_delivery_attempts as attempt
    where attempt.id = v_attempt_id and attempt.provider = 'brevo' for update;
  if not found then return 'UNMATCHED'; end if;
  if (v_attempt.provider_message_id is not null
      and private.brevo_message_key(v_attempt.provider_message_id) is distinct from v_key)
    or v_time < v_attempt.started_at - interval '5 minutes'
    or exists (
      select 1 from public.email_provider_events as evidence
      where evidence.message_key = v_key
        and evidence.delivery_attempt_id <> v_attempt.id
    )
    or exists (
      select 1 from public.email_provider_events as evidence
      where evidence.delivery_attempt_id = v_attempt.id
        and evidence.message_key <> v_key
    ) then
    return 'CORRELATION_CONFLICT';
  end if;

  -- Stable semantic identity; webhook payload id is a webhook ID, not an event ID.
  -- Exclude recipient, arbitrary reason, receipt time and other volatile metadata.
  v_fingerprint := encode(extensions.digest(
    'brevo/v1/' || v_key || '/' || p_event_type || '/' || p_event_epoch::text,
    'sha256'), 'hex');
  v_reason := case p_event_type
    when 'DELIVERED' then 'NONE'
    when 'DEFERRED' then 'TEMPORARY_DELIVERY_FAILURE'
    when 'SOFT_BOUNCED' then 'TEMPORARY_DELIVERY_FAILURE'
    when 'HARD_BOUNCED' then 'PERMANENT_DELIVERY_FAILURE'
    when 'INVALID' then 'INVALID_ADDRESS'
    when 'BLOCKED' then 'SENDING_BLOCKED'
    when 'COMPLAINT' then 'COMPLAINT'
    else 'PROVIDER_ERROR' end;
  insert into public.email_provider_events (
    email_event_id, delivery_attempt_id, provider, message_key,
    event_type, provider_event_at, reason_category, event_fingerprint
  ) values (
    v_attempt.email_event_id, v_attempt.id, 'brevo', v_key,
    p_event_type, v_time, v_reason, v_fingerprint
  ) on conflict (event_fingerprint) do nothing returning id into v_inserted;
  return case when v_inserted is null then 'DUPLICATE' else 'RECORDED' end;
end;
$$;
alter function public.ingest_brevo_transactional_event(text,text,bigint,text)
  owner to postgres;
revoke all on function public.ingest_brevo_transactional_event(text,text,bigint,text)
  from public, anon, authenticated;
grant execute on function public.ingest_brevo_transactional_event(text,text,bigint,text)
  to service_role;

-- Sticky terminal outcomes; receipt order never determines delivery state.
create function private.email_provider_state_rank(p_event_type text)
returns integer language sql immutable strict set search_path = ''
as $$
  select case p_event_type
    when 'COMPLAINT' then 80 when 'BLOCKED' then 70 when 'INVALID' then 60
    when 'HARD_BOUNCED' then 50 when 'DELIVERED' then 40 else 0 end;
$$;
alter function private.email_provider_state_rank(text) owner to postgres;
revoke all on function private.email_provider_state_rank(text)
  from public, anon, authenticated, service_role;

create function private.email_provider_delivery_summary(p_email_event_id uuid)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'outbox_status', event.status,
    'development_adapter', coalesce(
      attempt.provider = 'development'
      or event.provider_message_id like 'development-%', false),
    'provider_delivery_status', coalesce(current_evidence.event_type, 'UNKNOWN'),
    'provider_event_at', current_evidence.provider_event_at,
    'reason_category', current_evidence.reason_category,
    'evidence_received_at', (
      select max(evidence.received_at) from public.email_provider_events as evidence
      where evidence.email_event_id = event.id
    )
  )
  from public.email_events as event
  left join lateral (
    select delivery.id, delivery.provider, delivery.provider_message_id
    from public.email_delivery_attempts as delivery
    where delivery.email_event_id = event.id
    order by delivery.attempt_number desc limit 1
  ) as attempt on true
  left join lateral (
    select evidence.event_type, evidence.provider_event_at, evidence.reason_category
    from public.email_provider_events as evidence
    where evidence.delivery_attempt_id = attempt.id and attempt.provider = 'brevo'
      and (attempt.provider_message_id is null
        or private.brevo_message_key(attempt.provider_message_id) = evidence.message_key)
    order by private.email_provider_state_rank(evidence.event_type) desc,
      evidence.provider_event_at desc,
      case evidence.event_type when 'PROVIDER_ERROR' then 3
        when 'SOFT_BOUNCED' then 2 when 'DEFERRED' then 1 else 0 end desc,
      evidence.event_type
    limit 1
  ) as current_evidence on true
  where event.id = p_email_event_id;
$$;
alter function private.email_provider_delivery_summary(uuid) owner to postgres;
revoke all on function private.email_provider_delivery_summary(uuid)
  from public, anon, authenticated, service_role;

-- Additive bounded projections; existing strict RPC contracts stay unchanged.
create function public.get_platform_admin_email_delivery(p_email_event_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.require_platform_admin_read_access();
  if p_email_event_ids is null
    or coalesce(array_ndims(p_email_event_ids), 1) <> 1
    or coalesce(cardinality(p_email_event_ids), 0) > 20
    or array_position(p_email_event_ids, null) is not null then
    raise exception 'invalid_email_event_batch' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'email_event_id', event.id,
    'delivery', private.email_provider_delivery_summary(event.id)
  ) order by event.id), '[]'::jsonb) into v_result
  from public.email_events as event where event.id = any(p_email_event_ids);
  return v_result;
end;
$$;

create function public.get_platform_admin_email_provider_history(
  p_email_event_id uuid, p_before timestamptz default null, p_before_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.require_platform_admin_read_access();
  if p_email_event_id is null or ((p_before is null) <> (p_before_id is null)) then
    raise exception 'invalid_provider_history_cursor' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', evidence.id, 'event_type', evidence.event_type,
    'provider_event_at', evidence.provider_event_at,
    'received_at', evidence.received_at, 'reason_category', evidence.reason_category
  ) order by evidence.provider_event_at desc, evidence.id desc), '[]'::jsonb)
  into v_result from (
    select item.id, item.event_type, item.provider_event_at,
      item.received_at, item.reason_category
    from public.email_provider_events as item
    where item.email_event_id = p_email_event_id
      and (p_before is null or (item.provider_event_at, item.id) < (p_before, p_before_id))
    order by item.provider_event_at desc, item.id desc limit 50
  ) as evidence;
  return v_result;
end;
$$;

create function public.get_platform_admin_email_delivery_totals(p_range text default '7d')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_start timestamptz; v_result jsonb;
begin
  perform private.require_platform_admin_read_access();
  if p_range is null or p_range not in ('today', '7d', '30d') then
    raise exception 'invalid_delivery_reporting_range' using errcode = '22023';
  end if;
  v_start := case p_range
    when 'today' then date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    when '7d' then now() - interval '7 days'
    else now() - interval '30 days' end;
  with scoped as materialized (
    select event.id, event.status, attempt.provider, attempt.provider_message_id,
      private.email_provider_delivery_summary(event.id) as delivery
    from public.email_events as event
    left join lateral (
      select item.provider, item.provider_message_id
      from public.email_delivery_attempts as item where item.email_event_id = event.id
      order by item.attempt_number desc limit 1
    ) as attempt on true
    where event.created_at >= v_start and event.created_at <= now()
  ), classified as (
    select *, (delivery->>'development_adapter')::boolean as development,
      delivery->>'provider_delivery_status' as outcome from scoped
  )
  select jsonb_build_object(
    'range', p_range, 'range_start', v_start, 'refreshed_at', now(),
    'external_accepted', count(*) filter (where status = 'SENT'
      and provider in ('brevo', 'resend') and provider_message_id is not null
      and not development),
    'development_operations', count(*) filter (where development),
    'unknown_provider_operations', count(*) filter (where not development
      and (provider is null or provider = 'unknown')),
    'brevo_outcomes', jsonb_build_object(
      'unknown', count(*) filter (where provider = 'brevo' and outcome = 'UNKNOWN'),
      'delivered', count(*) filter (where provider = 'brevo' and outcome = 'DELIVERED'),
      'deferred', count(*) filter (where provider = 'brevo' and outcome = 'DEFERRED'),
      'soft_bounced', count(*) filter (where provider = 'brevo' and outcome = 'SOFT_BOUNCED'),
      'hard_bounced', count(*) filter (where provider = 'brevo' and outcome = 'HARD_BOUNCED'),
      'invalid', count(*) filter (where provider = 'brevo' and outcome = 'INVALID'),
      'blocked', count(*) filter (where provider = 'brevo' and outcome = 'BLOCKED'),
      'complaint', count(*) filter (where provider = 'brevo' and outcome = 'COMPLAINT'),
      'provider_error', count(*) filter (where provider = 'brevo' and outcome = 'PROVIDER_ERROR')
    )
  ) into v_result from classified;
  return v_result;
end;
$$;

-- Only the latest, non-revoked confirmation capability's email is relevant.
-- A freshly shared manual link with no email must not inherit an old bounce.
create function public.get_booking_confirmation_delivery(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_business_id uuid;
  v_link_id uuid;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select booking.business_id into v_business_id from public.bookings as booking
    where booking.id = p_booking_id;
  if v_business_id is null or not private.is_business_member(v_business_id) then
    raise exception 'booking_unavailable' using errcode = '42501';
  end if;
  select link.id into v_link_id from public.confirmation_links as link
    where link.business_id = v_business_id and link.booking_id = p_booking_id
      and link.revoked_at is null
    order by link.created_at desc, link.id desc limit 1;
  select event.id into v_event_id from public.email_events as event
    where event.business_id = v_business_id and event.booking_id = p_booking_id
      and event.confirmation_link_id = v_link_id
      and event.event_type = 'BOOKING_CONFIRMATION_REQUESTED'
    limit 1;
  if v_event_id is null then return null; end if;
  return private.email_provider_delivery_summary(v_event_id);
end;
$$;

alter function public.get_platform_admin_email_delivery(uuid[]) owner to postgres;
alter function public.get_platform_admin_email_delivery_totals(text) owner to postgres;
alter function public.get_platform_admin_email_provider_history(uuid,timestamptz,uuid)
  owner to postgres;
alter function public.get_booking_confirmation_delivery(uuid) owner to postgres;
revoke all on function public.get_platform_admin_email_delivery(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.get_platform_admin_email_delivery_totals(text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_platform_admin_email_provider_history(uuid,timestamptz,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_booking_confirmation_delivery(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_platform_admin_email_delivery(uuid[]) to authenticated;
grant execute on function public.get_platform_admin_email_delivery_totals(text) to authenticated;
grant execute on function public.get_platform_admin_email_provider_history(uuid,timestamptz,uuid)
  to authenticated;
grant execute on function public.get_booking_confirmation_delivery(uuid) to authenticated;

comment on table public.email_provider_events is
  'Append-only, idempotent Brevo evidence. No raw payload, recipient or message body. SENT remains outbox acceptance, not delivery.';
comment on function public.ingest_brevo_transactional_event(text,text,bigint,text) is
  'Service-only ingestion. Exact attempt/message correlation; no recipient authority, retry, notification or lifecycle writes.';
commit;
