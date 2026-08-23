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
  caller_user_id uuid;
  booking_row public.bookings;
  updated_row public.bookings;
  confirmation_row public.booking_confirmations;
  clean_reason text;
  cancellation_recipient text;
  created_email_event_id uuid;
  v_changed_at timestamptz := now();
  audit_type public.audit_event_type;
begin
  caller_user_id := auth.uid();

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

  if p_to_status = 'CANCELLED'
    and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
  then
    select confirmation.*
    into confirmation_row
    from public.booking_confirmations as confirmation
    where confirmation.business_id = booking_row.business_id
      and confirmation.booking_id = booking_row.id
    order by confirmation.confirmed_at desc, confirmation.id desc
    limit 1;

    cancellation_recipient := confirmation_row.contact_email;

    if cancellation_recipient is null then
      select lower(trim(customer.email))
      into cancellation_recipient
      from public.customers as customer
      where customer.business_id = booking_row.business_id
        and customer.id = booking_row.customer_id;
    end if;

    if confirmation_row.id is not null and cancellation_recipient is not null then
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
        'BOOKING_CANCELLED',
        cancellation_recipient
      )
      on conflict (booking_confirmation_id, event_type) do nothing
      returning id into created_email_event_id;

      if created_email_event_id is null then
        select event.id
        into created_email_event_id
        from public.email_events as event
        where event.booking_confirmation_id = confirmation_row.id
          and event.event_type = 'BOOKING_CANCELLED';
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

revoke all on function public.transition_booking_status(uuid, public.booking_status, text)
from public, anon, authenticated;
grant execute on function public.transition_booking_status(uuid, public.booking_status, text)
to authenticated, service_role;
