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
    when lower(p_failure_code) = 'provider_not_configured'
      or lower(p_failure_code) like '%_url_unavailable'
      or lower(p_failure_code) like 'invalid_%' then 'configuration_error'
    when lower(p_failure_code) ~ '^provider_http_4[0-9][0-9]$' then 'provider_rejected'
    when lower(p_failure_code) ~ '^provider_http_5[0-9][0-9]$'
      or lower(p_failure_code) in (
        'provider_invalid_response',
        'delivery_state_update_failed'
      ) then 'temporary_provider_failure'
    else 'unknown_failure'
  end;
$$;

alter function private.classify_email_failure(text) owner to postgres;

revoke all on function private.classify_email_failure(text)
from public, anon, authenticated;

create or replace function public.get_platform_admin_email_operations(
  p_search text default null,
  p_status text default 'all',
  p_event_type text default 'all',
  p_range text default '7d',
  p_business_id uuid default null,
  p_booking_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_search text := lower(nullif(trim(left(coalesce(p_search, ''), 80)), ''));
  v_status text := upper(coalesce(nullif(trim(p_status), ''), 'ALL'));
  v_event_type text := upper(coalesce(nullif(trim(p_event_type), ''), 'ALL'));
  v_range text := lower(coalesce(nullif(trim(p_range), ''), '7d'));
  v_now timestamptz := statement_timestamp();
  v_range_start timestamptz;
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  if not (v_status = any (array['ALL', 'PENDING', 'SENDING', 'SENT', 'FAILED'])) then
    raise exception 'invalid_admin_email_status' using errcode = '22023';
  end if;

  if not (v_event_type = any (array[
    'ALL',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_AMENDMENT_REQUESTED',
    'BOOKING_AMENDMENT_CONFIRMED',
    'BOOKING_ADDON_REQUESTED',
    'BOOKING_ADDON_CONFIRMED'
  ])) then
    raise exception 'invalid_admin_email_event_type' using errcode = '22023';
  end if;

  v_range_start := case v_range
    when 'today' then date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC'
    when '7d' then v_now - interval '7 days'
    when '30d' then v_now - interval '30 days'
    else null
  end;

  if v_range_start is null then
    raise exception 'invalid_admin_email_range' using errcode = '22023';
  end if;

  with base_filtered as materialized (
    select
      email_event.id,
      email_event.business_id,
      email_event.booking_id,
      email_event.event_type,
      email_event.status,
      email_event.attempt_count,
      email_event.created_at,
      email_event.last_attempt_at,
      email_event.sent_at,
      business.name as business_name,
      business.slug as business_slug,
      booking.reference as booking_reference,
      booking.title as booking_title
    from public.email_events as email_event
    join public.businesses as business on business.id = email_event.business_id
    join public.bookings as booking
      on booking.id = email_event.booking_id
      and booking.business_id = email_event.business_id
    where email_event.created_at >= v_range_start
      and (p_business_id is null or email_event.business_id = p_business_id)
      and (p_booking_id is null or email_event.booking_id = p_booking_id)
      and (
        v_event_type = 'ALL'
        or email_event.event_type::text = v_event_type
      )
      and (
        v_search is null
        or position(v_search in lower(booking.reference)) > 0
        or position(v_search in lower(business.name)) > 0
        or position(v_search in lower(email_event.event_type::text)) > 0
      )
  ),
  matching as materialized (
    select base_filtered.*
    from base_filtered
    where v_status = 'ALL' or base_filtered.status::text = v_status
  ),
  paged as materialized (
    select matching.*
    from matching
    order by matching.created_at desc, matching.id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total', (select count(*) from base_filtered),
      'pending', (select count(*) from base_filtered where status = 'PENDING'::public.email_event_status),
      'sending', (select count(*) from base_filtered where status = 'SENDING'::public.email_event_status),
      'sent', (select count(*) from base_filtered where status = 'SENT'::public.email_event_status),
      'failed', (select count(*) from base_filtered where status = 'FAILED'::public.email_event_status),
      'potentially_stuck', (
        select count(*)
        from base_filtered
        where status in (
          'PENDING'::public.email_event_status,
          'SENDING'::public.email_event_status
        )
          and coalesce(last_attempt_at, created_at) < v_now - interval '15 minutes'
      ),
      'range', v_range,
      'range_start', v_range_start,
      'refreshed_at', v_now
    ),
    'event_types', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event_type', event_counts.event_type,
          'count', event_counts.total,
          'failed', event_counts.failed
        )
        order by event_counts.event_type
      )
      from (
        select
          base_filtered.event_type,
          count(*) as total,
          count(*) filter (
            where base_filtered.status = 'FAILED'::public.email_event_status
          ) as failed
        from base_filtered
        group by base_filtered.event_type
      ) as event_counts
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', paged.id,
          'event_type', paged.event_type,
          'status', paged.status,
          'business', jsonb_build_object(
            'id', paged.business_id,
            'name', paged.business_name,
            'slug', paged.business_slug
          ),
          'booking', jsonb_build_object(
            'id', paged.booking_id,
            'reference', paged.booking_reference,
            'title', paged.booking_title
          ),
          'attempt_count', paged.attempt_count,
          'created_at', paged.created_at,
          'last_attempt_at', paged.last_attempt_at,
          'sent_at', paged.sent_at
        )
        order by paged.created_at desc, paged.id desc
      )
      from paged
    ), '[]'::jsonb),
    'page', v_page,
    'page_size', v_page_size,
    'total', (select count(*) from matching)
  )
  into v_result;

  return v_result;
end;
$$;

alter function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) owner to postgres;

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
    end
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

alter function public.get_platform_admin_email_event(uuid) owner to postgres;

revoke all on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) from public, anon, authenticated;
revoke all on function public.get_platform_admin_email_event(uuid)
from public, anon, authenticated;

grant execute on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) to authenticated;
grant execute on function public.get_platform_admin_email_event(uuid)
to authenticated;

comment on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) is
  'Returns a bounded read-only email operations summary and event directory to an active platform administrator.';
comment on function public.get_platform_admin_email_event(uuid) is
  'Returns one minimized read-only email event diagnostic projection to an active platform administrator.';

notify pgrst, 'reload schema';
