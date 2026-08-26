alter table public.booking_changes
  add constraint booking_changes_business_booking_id_key
  unique (business_id, booking_id, id);

alter table public.confirmation_links
  add constraint confirmation_links_business_booking_id_key
  unique (business_id, booking_id, id);

alter table public.email_events
  drop constraint email_events_subject_check,
  add column booking_change_id uuid,
  add column confirmation_link_id uuid,
  add constraint email_events_booking_change_business_fk
    foreign key (business_id, booking_id, booking_change_id)
    references public.booking_changes (business_id, booking_id, id)
    on delete cascade,
  add constraint email_events_confirmation_link_business_fk
    foreign key (business_id, booking_id, confirmation_link_id)
    references public.confirmation_links (business_id, booking_id, id)
    on delete cascade,
  add constraint email_events_subject_check
    check (
      (
        booking_confirmation_id is not null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and event_type in (
          'BOOKING_CONFIRMED',
          'BOOKING_CANCELLED',
          'BOOKING_DELIVERED'
        )
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is not null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and event_type in (
          'BOOKING_AMENDMENT_REQUESTED',
          'BOOKING_AMENDMENT_CONFIRMED'
        )
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is not null
        and booking_change_id is null
        and confirmation_link_id is null
        and event_type = 'BOOKING_ADDON_REQUESTED'
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and event_type = 'BOOKING_ADDON_CONFIRMED'
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is not null
        and confirmation_link_id is not null
        and event_type = 'BOOKING_RESCHEDULED'
      )
    );

create unique index email_events_reschedule_change_unique
on public.email_events (booking_change_id)
where event_type = 'BOOKING_RESCHEDULED';

create unique index email_events_reschedule_link_unique
on public.email_events (confirmation_link_id)
where event_type = 'BOOKING_RESCHEDULED';

create or replace function public.transition_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_cancellation_reason text default null
)
returns table (
  booking_id uuid,
  from_status public.booking_status,
  to_status public.booking_status,
  changed_at timestamptz,
  email_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  updated_row public.bookings;
  confirmation_row public.booking_confirmations;
  clean_reason text;
  notification_recipient text;
  created_email_event_id uuid;
  v_changed_at timestamptz := now();
  audit_type public.audit_event_type;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status = p_to_status then
    raise exception 'booking_already_in_target_status'
      using errcode = '23000';
  end if;

  clean_reason := nullif(trim(coalesce(p_cancellation_reason, '')), '');

  if p_to_status = 'CANCELLED' and clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'cancellation_reason_too_long'
      using errcode = '22023';
  end if;

  if p_to_status = 'CANCELLED'
    and clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'
  then
    raise exception 'cancellation_reason_must_be_plain_text'
      using errcode = '22023';
  end if;

  if p_to_status = 'CANCELLED'
    and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    and clean_reason is null
  then
    raise exception 'cancellation_reason_required'
      using errcode = '22023';
  end if;

  if p_to_status <> 'CANCELLED' and clean_reason is not null then
    raise exception 'cancellation_reason_only_allowed_for_cancellation'
      using errcode = '22023';
  end if;

  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings as booking
  set status = p_to_status,
      cancellation_reason = case when p_to_status = 'CANCELLED' then clean_reason else null end
  where booking.id = booking_row.id
  returning booking.* into updated_row;

  if p_to_status in ('READY', 'CANCELLED') then
    perform private.revoke_pending_booking_amendments(
      booking_row.id,
      case when p_to_status = 'CANCELLED' then 'booking_cancelled' else 'booking_advanced' end,
      caller_user_id
    );
  end if;

  if (
    p_to_status = 'DELIVERED'
    or (
      p_to_status = 'CANCELLED'
      and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    )
  ) then
    select confirmation.*
    into confirmation_row
    from public.booking_confirmations as confirmation
    where confirmation.business_id = booking_row.business_id
      and confirmation.booking_id = booking_row.id
    order by confirmation.confirmed_at desc, confirmation.id desc
    limit 1;

    notification_recipient := confirmation_row.contact_email;

    if notification_recipient is null then
      select lower(trim(customer.email))
      into notification_recipient
      from public.customers as customer
      where customer.business_id = booking_row.business_id
        and customer.id = booking_row.customer_id;
    end if;

    if confirmation_row.id is not null and notification_recipient is not null then
      insert into public.email_events (
        business_id,
        booking_id,
        customer_id,
        booking_confirmation_id,
        event_type,
        recipient_email
      )
      values (
        booking_row.business_id,
        booking_row.id,
        booking_row.customer_id,
        confirmation_row.id,
        case
          when p_to_status = 'DELIVERED'
            then 'BOOKING_DELIVERED'::public.email_event_type
          else 'BOOKING_CANCELLED'::public.email_event_type
        end,
        notification_recipient
      )
      on conflict (booking_confirmation_id, event_type) do nothing
      returning id into created_email_event_id;

      if created_email_event_id is null then
        select event.id
        into created_email_event_id
        from public.email_events as event
        where event.booking_confirmation_id = confirmation_row.id
          and event.event_type = case
            when p_to_status = 'DELIVERED'
              then 'BOOKING_DELIVERED'::public.email_event_type
            else 'BOOKING_CANCELLED'::public.email_event_type
          end;
      end if;
    end if;
  end if;

  audit_type := case
    when p_to_status = 'CANCELLED' then 'BOOKING_CANCELLED'::public.audit_event_type
    when p_to_status = 'COMPLETED' then 'BOOKING_COMPLETED'::public.audit_event_type
    else 'BOOKING_STATUS_CHANGED'::public.audit_event_type
  end;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    audit_type,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'from_status', booking_row.status,
      'to_status', p_to_status,
      'cancellation_reason_provided', clean_reason is not null,
      'email_event_created', created_email_event_id is not null
    )
  );

  return query
  select updated_row.id, booking_row.status, updated_row.status, v_changed_at, created_email_event_id;
end;
$$;

create or replace function public.reschedule_booking_with_notification(
  p_booking_id uuid,
  p_scheduled_for timestamptz,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '24 hours'
)
returns table (
  booking_id uuid,
  previous_scheduled_for timestamptz,
  new_scheduled_for timestamptz,
  status public.booking_status,
  confirmation_link_id uuid,
  expires_at timestamptz,
  email_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  reschedule_result record;
  booking_row public.bookings;
  confirmation_row public.booking_confirmations;
  change_row public.booking_changes;
  notification_recipient text;
  created_confirmation_link_id uuid;
  created_email_event_id uuid;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'confirmation_link_expiration_invalid'
      using errcode = '22023';
  end if;

  select *
  into reschedule_result
  from public.reschedule_booking(p_booking_id, p_scheduled_for);

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = reschedule_result.booking_id
  for update;

  select confirmation.*
  into confirmation_row
  from public.booking_confirmations as confirmation
  where confirmation.business_id = booking_row.business_id
    and confirmation.booking_id = booking_row.id
  order by confirmation.confirmed_at desc, confirmation.id desc
  limit 1;

  if confirmation_row.id is not null then
    notification_recipient := confirmation_row.contact_email;

    if notification_recipient is null then
      select lower(trim(customer.email))
      into notification_recipient
      from public.customers as customer
      where customer.business_id = booking_row.business_id
        and customer.id = booking_row.customer_id;
    end if;
  end if;

  if confirmation_row.id is not null and notification_recipient is not null then
    select change.*
    into change_row
    from public.booking_changes as change
    where change.business_id = booking_row.business_id
      and change.booking_id = booking_row.id
      and change.changed_by = caller_user_id
      and change.change_type = 'reschedule'
      and change.previous_scheduled_for is not distinct from reschedule_result.previous_scheduled_for
      and change.new_scheduled_for is not distinct from reschedule_result.new_scheduled_for
    order by change.created_at desc, change.id desc
    limit 1;

    if change_row.id is null then
      raise exception 'reschedule_change_evidence_unavailable'
        using errcode = '23000';
    end if;

    insert into public.confirmation_links (
      business_id,
      booking_id,
      token_hash,
      expires_at,
      created_by
    )
    values (
      booking_row.business_id,
      booking_row.id,
      p_token_hash,
      p_expires_at,
      caller_user_id
    )
    returning id into created_confirmation_link_id;

    insert into public.email_events (
      business_id,
      booking_id,
      customer_id,
      booking_change_id,
      confirmation_link_id,
      event_type,
      recipient_email
    )
    values (
      booking_row.business_id,
      booking_row.id,
      booking_row.customer_id,
      change_row.id,
      created_confirmation_link_id,
      'BOOKING_RESCHEDULED',
      notification_recipient
    )
    returning id into created_email_event_id;

    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      caller_user_id,
      booking_row.business_id,
      'CONFIRMATION_LINK_CREATED',
      jsonb_build_object(
        'booking_id', booking_row.id,
        'confirmation_link_id', created_confirmation_link_id,
        'expires_at', p_expires_at,
        'source', 'booking_rescheduled',
        'email_event_created', true
      )
    );
  end if;

  return query
  select
    reschedule_result.booking_id,
    reschedule_result.previous_scheduled_for,
    reschedule_result.new_scheduled_for,
    reschedule_result.status,
    created_confirmation_link_id,
    case when created_confirmation_link_id is null then null else p_expires_at end,
    created_email_event_id;
end;
$$;

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
    'BOOKING_ADDON_CONFIRMED',
    'BOOKING_RESCHEDULED',
    'BOOKING_DELIVERED'
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

alter function public.transition_booking_status(uuid, public.booking_status, text)
owner to postgres;
alter function public.reschedule_booking_with_notification(uuid, timestamptz, text, timestamptz)
owner to postgres;
alter function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) owner to postgres;

revoke all on function public.transition_booking_status(uuid, public.booking_status, text)
from public, anon, authenticated;
revoke all on function public.reschedule_booking_with_notification(uuid, timestamptz, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) from public, anon, authenticated;

grant execute on function public.transition_booking_status(uuid, public.booking_status, text)
to authenticated, service_role;
grant execute on function public.reschedule_booking_with_notification(uuid, timestamptz, text, timestamptz)
to authenticated, service_role;
grant execute on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) to authenticated;

comment on function public.reschedule_booking_with_notification(
  uuid, timestamptz, text, timestamptz
) is
  'Atomically reschedules a tenant-owned booking and, when prior immutable confirmation contact exists, creates a replacement confirmation link and one durable BOOKING_RESCHEDULED email event.';

notify pgrst, 'reload schema';
