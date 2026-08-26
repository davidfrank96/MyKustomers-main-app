alter type public.audit_event_type
  add value if not exists 'PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED';
alter type public.audit_event_type
  add value if not exists 'PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED';
alter type public.audit_event_type
  add value if not exists 'PLATFORM_ADMIN_EMAIL_RETRY_FAILED';

create or replace function private.classify_email_failure(p_failure_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_failure_code is null then null
    when lower(p_failure_code) like '%recipient%' then 'invalid_recipient'
    when lower(p_failure_code) = 'provider_http_429'
      or lower(p_failure_code) like '%rate%' then 'rate_limited'
    when lower(p_failure_code) in (
      'provider_timeout',
      'provider_network_failure',
      'provider_invalid_response',
      'provider_exception',
      'delivery_state_update_failed'
    ) then 'ambiguous_outcome'
    when lower(p_failure_code) in (
      'provider_not_configured',
      'provider_http_401',
      'provider_http_403',
      'invalid_sender'
    )
      or lower(p_failure_code) like '%_url_unavailable'
      or lower(p_failure_code) like 'invalid_%' then 'configuration_error'
    when lower(p_failure_code) ~ '^provider_http_4[0-9][0-9]$'
      then 'provider_rejected'
    when lower(p_failure_code) ~ '^provider_http_5[0-9][0-9]$'
      or lower(p_failure_code) = 'provider_connect_failure'
      then 'temporary_provider_failure'
    else 'unknown_failure'
  end;
$$;

create type public.email_delivery_attempt_origin as enum (
  'DOMAIN_EVENT',
  'ADMIN_RETRY'
);

create type public.email_delivery_attempt_status as enum (
  'SENDING',
  'SENT',
  'FAILED'
);

create table public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  email_event_id uuid not null references public.email_events(id) on delete cascade,
  attempt_number integer not null,
  provider text not null,
  origin public.email_delivery_attempt_origin not null,
  requested_by uuid references auth.users(id) on delete set null,
  reason text,
  status public.email_delivery_attempt_status not null default 'SENDING',
  provider_message_id text,
  failure_code text,
  failure_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint email_delivery_attempts_event_number_unique
    unique (email_event_id, attempt_number),
  constraint email_delivery_attempts_attempt_number_positive
    check (attempt_number > 0),
  constraint email_delivery_attempts_provider_check
    check (provider in ('development', 'brevo', 'resend', 'unknown')),
  constraint email_delivery_attempts_reason_length
    check (reason is null or char_length(reason) between 1 and 500),
  constraint email_delivery_attempts_origin_consistency check (
    (
      origin = 'DOMAIN_EVENT'
      and requested_by is null
      and reason is null
    )
    or (
      origin = 'ADMIN_RETRY'
      and requested_by is not null
      and reason is not null
    )
  ),
  constraint email_delivery_attempts_provider_message_id_length
    check (provider_message_id is null or char_length(provider_message_id) <= 255),
  constraint email_delivery_attempts_failure_code_length
    check (failure_code is null or char_length(failure_code) <= 80),
  constraint email_delivery_attempts_failure_message_length
    check (failure_message is null or char_length(failure_message) <= 500),
  constraint email_delivery_attempts_result_consistency check (
    (
      status = 'SENDING'
      and completed_at is null
      and provider_message_id is null
      and failure_code is null
      and failure_message is null
    )
    or (
      status = 'SENT'
      and completed_at is not null
      and provider_message_id is not null
      and failure_code is null
      and failure_message is null
    )
    or (
      status = 'FAILED'
      and completed_at is not null
      and provider_message_id is null
      and failure_code is not null
      and failure_message is not null
    )
  )
);

create index email_delivery_attempts_event_started_idx
on public.email_delivery_attempts (email_event_id, started_at desc, id desc);

alter table public.email_delivery_attempts enable row level security;

revoke all on public.email_delivery_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.email_delivery_attempts to service_role;

create or replace function public.claim_email_event(
  p_email_event_id uuid,
  p_provider text
)
returns setof public.email_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_event public.email_events;
begin
  if not (v_provider = any (array['development', 'brevo', 'resend', 'unknown'])) then
    raise exception 'invalid_email_provider' using errcode = '22023';
  end if;

  update public.email_events
  set status = 'SENDING',
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      provider_message_id = null,
      failure_code = null,
      failure_message = null,
      sent_at = null
  where id = p_email_event_id
    and status = 'PENDING'
  returning * into v_event;

  if not found then
    return;
  end if;

  insert into public.email_delivery_attempts (
    email_event_id,
    attempt_number,
    provider,
    origin,
    started_at
  )
  values (
    v_event.id,
    v_event.attempt_count,
    v_provider,
    'DOMAIN_EVENT',
    v_event.last_attempt_at
  );

  return next v_event;
end;
$$;

create or replace function public.claim_email_event(p_email_event_id uuid)
returns setof public.email_events
language sql
security invoker
set search_path = ''
as $$
  select *
  from public.claim_email_event(p_email_event_id, 'unknown');
$$;

create or replace function public.claim_platform_admin_email_retry(
  p_email_event_id uuid,
  p_admin_user_id uuid,
  p_reason text,
  p_expected_attempt_count integer,
  p_expected_failure_code text,
  p_expected_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_provider text := lower(trim(coalesce(p_expected_provider, '')));
  v_event public.email_events;
  v_previous_attempt public.email_delivery_attempts;
  v_attempt_id uuid;
  v_new_attempt_number integer;
begin
  if p_admin_user_id is null or not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.user_id = p_admin_user_id
      and platform_admin.role = 'SUPER_ADMIN'
      and platform_admin.status = 'ACTIVE'
  ) then
    return jsonb_build_object('status', 'NOT_AUTHORIZED');
  end if;

  if char_length(v_reason) < 1 or char_length(v_reason) > 500 then
    return jsonb_build_object('status', 'INVALID_REASON');
  end if;

  select *
  into v_event
  from public.email_events
  where id = p_email_event_id
  for update;

  if not found then
    return jsonb_build_object('status', 'NOT_FOUND');
  end if;

  if v_event.status <> 'FAILED'
    or v_event.attempt_count <> p_expected_attempt_count
    or v_event.failure_code is distinct from p_expected_failure_code then
    return jsonb_build_object('status', 'STALE');
  end if;

  select *
  into v_previous_attempt
  from public.email_delivery_attempts
  where email_event_id = v_event.id
    and attempt_number = v_event.attempt_count
  for update;

  if not found
    or v_previous_attempt.status <> 'FAILED'
    or v_previous_attempt.failure_code is distinct from v_event.failure_code
    or v_previous_attempt.provider <> v_provider
    or v_provider not in ('development', 'brevo', 'resend') then
    return jsonb_build_object('status', 'RETRY_UNAVAILABLE');
  end if;

  v_new_attempt_number := v_event.attempt_count + 1;

  update public.email_events
  set status = 'SENDING',
      attempt_count = v_new_attempt_number,
      last_attempt_at = now(),
      provider_message_id = null,
      failure_code = null,
      failure_message = null,
      sent_at = null
  where id = v_event.id;

  insert into public.email_delivery_attempts (
    email_event_id,
    attempt_number,
    provider,
    origin,
    requested_by,
    reason,
    started_at
  )
  values (
    v_event.id,
    v_new_attempt_number,
    v_provider,
    'ADMIN_RETRY',
    p_admin_user_id,
    v_reason,
    now()
  )
  returning id into v_attempt_id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    p_admin_user_id,
    v_event.business_id,
    'PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED',
    jsonb_build_object(
      'email_event_id', v_event.id,
      'booking_id', v_event.booking_id,
      'previous_attempt_count', v_event.attempt_count,
      'new_attempt_count', v_new_attempt_number,
      'provider', v_provider,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'status', 'CLAIMED',
    'attempt_id', v_attempt_id,
    'attempt_number', v_new_attempt_number,
    'provider', v_provider
  );
end;
$$;

create or replace function public.finalize_email_delivery_attempt(
  p_email_event_id uuid,
  p_attempt_id uuid,
  p_result text,
  p_provider_message_id text default null,
  p_failure_code text default null,
  p_failure_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result text := upper(trim(coalesce(p_result, '')));
  v_attempt public.email_delivery_attempts;
  v_event public.email_events;
  v_completed_at timestamptz := now();
  v_provider_message_id text := nullif(left(coalesce(p_provider_message_id, ''), 255), '');
  v_failure_code text := nullif(left(coalesce(p_failure_code, ''), 80), '');
  v_failure_message text := nullif(left(coalesce(p_failure_message, ''), 500), '');
begin
  if v_result not in ('SENT', 'FAILED') then
    raise exception 'invalid_email_delivery_result' using errcode = '22023';
  end if;

  if (v_result = 'SENT' and v_provider_message_id is null)
    or (v_result = 'FAILED' and (v_failure_code is null or v_failure_message is null)) then
    raise exception 'incomplete_email_delivery_result' using errcode = '22023';
  end if;

  select *
  into v_event
  from public.email_events
  where id = p_email_event_id
  for update;

  if not found or v_event.status <> 'SENDING' then
    return false;
  end if;

  select *
  into v_attempt
  from public.email_delivery_attempts
  where id = p_attempt_id
    and email_event_id = v_event.id
    and attempt_number = v_event.attempt_count
  for update;

  if not found or v_attempt.status <> 'SENDING' then
    return false;
  end if;

  if v_result = 'SENT' then
    update public.email_delivery_attempts
    set status = 'SENT',
        provider_message_id = v_provider_message_id,
        completed_at = v_completed_at
    where id = v_attempt.id;

    update public.email_events
    set status = 'SENT',
        provider_message_id = v_provider_message_id,
        failure_code = null,
        failure_message = null,
        sent_at = v_completed_at
    where id = v_event.id;
  else
    update public.email_delivery_attempts
    set status = 'FAILED',
        failure_code = v_failure_code,
        failure_message = v_failure_message,
        completed_at = v_completed_at
    where id = v_attempt.id;

    update public.email_events
    set status = 'FAILED',
        provider_message_id = null,
        failure_code = v_failure_code,
        failure_message = v_failure_message,
        sent_at = null
    where id = v_event.id;
  end if;

  if v_attempt.origin = 'ADMIN_RETRY' then
    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      v_attempt.requested_by,
      v_event.business_id,
      case
        when v_result = 'SENT'
          then 'PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED'::public.audit_event_type
        else 'PLATFORM_ADMIN_EMAIL_RETRY_FAILED'::public.audit_event_type
      end,
      jsonb_build_object(
        'email_event_id', v_event.id,
        'booking_id', v_event.booking_id,
        'attempt_count', v_attempt.attempt_number,
        'provider', v_attempt.provider,
        'reason', v_attempt.reason,
        'result', case when v_result = 'SENT' then 'PROVIDER_ACCEPTED' else 'FAILED' end,
        'failure_category', case
          when v_result = 'FAILED'
            then private.classify_email_failure(v_failure_code)
          else null
        end
      )
    );
  end if;

  return true;
end;
$$;

create or replace function public.get_platform_admin_email_event(p_email_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  select jsonb_build_object(
    'id', email_event.id,
    'event_type', email_event.event_type,
    'status', email_event.status,
    'business', jsonb_build_object(
      'id', business.id,
      'name', business.name,
      'slug', business.slug
    ),
    'booking', jsonb_build_object(
      'id', booking.id,
      'reference', booking.reference,
      'title', booking.title
    ),
    'recipient_masked', private.mask_contact_email(email_event.recipient_email),
    'attempt_count', email_event.attempt_count,
    'created_at', email_event.created_at,
    'last_attempt_at', email_event.last_attempt_at,
    'sent_at', email_event.sent_at,
    'failure_category', case
      when email_event.status = 'FAILED'::public.email_event_status
        then private.classify_email_failure(email_event.failure_code)
      else null
    end,
    'retry_failure_code', case
      when email_event.status = 'FAILED'::public.email_event_status
        then email_event.failure_code
      else null
    end,
    'delivery_attempts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'attempt_number', attempt.attempt_number,
          'provider', attempt.provider,
          'origin', attempt.origin,
          'status', attempt.status,
          'started_at', attempt.started_at,
          'completed_at', attempt.completed_at,
          'failure_category', case
            when attempt.status = 'FAILED'::public.email_delivery_attempt_status
              then private.classify_email_failure(attempt.failure_code)
            else null
          end,
          'retry_failure_code', case
            when attempt.status = 'FAILED'::public.email_delivery_attempt_status
              then attempt.failure_code
            else null
          end
        )
        order by attempt.attempt_number desc
      )
      from (
        select email_delivery_attempt.*
        from public.email_delivery_attempts as email_delivery_attempt
        where email_delivery_attempt.email_event_id = email_event.id
        order by email_delivery_attempt.attempt_number desc
        limit 20
      ) as attempt
    ), '[]'::jsonb)
  )
  into v_result
  from public.email_events as email_event
  join public.businesses as business on business.id = email_event.business_id
  join public.bookings as booking
    on booking.id = email_event.booking_id
    and booking.business_id = email_event.business_id
  where email_event.id = p_email_event_id;

  return v_result;
end;
$$;

alter function public.claim_email_event(uuid, text) owner to postgres;
alter function private.classify_email_failure(text) owner to postgres;
alter function public.claim_email_event(uuid) owner to postgres;
alter function public.claim_platform_admin_email_retry(
  uuid, uuid, text, integer, text, text
) owner to postgres;
alter function public.finalize_email_delivery_attempt(
  uuid, uuid, text, text, text, text
) owner to postgres;
alter function public.get_platform_admin_email_event(uuid) owner to postgres;

revoke all on function public.claim_email_event(uuid, text)
from public, anon, authenticated;
revoke all on function private.classify_email_failure(text)
from public, anon, authenticated;
revoke all on function public.claim_email_event(uuid)
from public, anon, authenticated;
revoke all on function public.claim_platform_admin_email_retry(
  uuid, uuid, text, integer, text, text
) from public, anon, authenticated;
revoke all on function public.finalize_email_delivery_attempt(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.get_platform_admin_email_event(uuid)
from public, anon, authenticated;

grant execute on function public.claim_email_event(uuid, text) to service_role;
grant execute on function public.claim_email_event(uuid) to service_role;
grant execute on function public.claim_platform_admin_email_retry(
  uuid, uuid, text, integer, text, text
) to service_role;
grant execute on function public.finalize_email_delivery_attempt(
  uuid, uuid, text, text, text, text
) to service_role;
grant execute on function public.get_platform_admin_email_event(uuid)
to authenticated;

comment on table public.email_delivery_attempts is
  'Append-only delivery-attempt evidence for one logical transactional email event.';
comment on function public.claim_email_event(uuid, text) is
  'Atomically claims one pending email event and records its provider-pinned delivery attempt.';
comment on function public.claim_platform_admin_email_retry(
  uuid, uuid, text, integer, text, text
) is
  'Atomically claims a stale-safe failed-email retry for an already server-authorized active super admin.';
comment on function public.finalize_email_delivery_attempt(
  uuid, uuid, text, text, text, text
) is
  'Atomically persists provider acceptance or bounded failure evidence for the current delivery attempt.';

notify pgrst, 'reload schema';
