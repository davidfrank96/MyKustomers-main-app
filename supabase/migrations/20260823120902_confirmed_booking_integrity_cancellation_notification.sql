alter type public.email_event_type add value if not exists 'BOOKING_CANCELLED';

alter table public.email_events
  drop constraint email_events_confirmation_key,
  add constraint email_events_confirmation_event_key
    unique (booking_confirmation_id, event_type);

alter table public.bookings
  add constraint bookings_cancellation_reason_plain_text
    check (
      cancellation_reason is null
      or cancellation_reason !~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'
    );

create or replace function private.booking_material_terms_changed(
  old_booking public.bookings,
  new_booking public.bookings
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select old_booking.customer_id is distinct from new_booking.customer_id
    or old_booking.title is distinct from new_booking.title
    or old_booking.description is distinct from new_booking.description
    or old_booking.currency is distinct from new_booking.currency
    or old_booking.total_amount_minor is distinct from new_booking.total_amount_minor
    or old_booking.deposit_amount_minor is distinct from new_booking.deposit_amount_minor
    or old_booking.scheduled_for is distinct from new_booking.scheduled_for;
$$;

create or replace function private.enforce_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  material_changed boolean := false;
  requested_status_change boolean := false;
  transition_allowed boolean := false;
  reschedule_allowed boolean := false;
  revoked_count integer := 0;
  v_now timestamptz := now();
begin
  caller_user_id := auth.uid();
  transition_allowed := coalesce(current_setting('app.booking_transition_allowed', true), 'false') = 'true';
  reschedule_allowed := coalesce(current_setting('app.booking_reschedule_allowed', true), 'false') = 'true';

  if tg_op = 'INSERT' then
    if caller_user_id is not null and new.created_by is distinct from caller_user_id then
      raise exception 'booking_created_by_must_match_authenticated_user'
        using errcode = '23000';
    end if;

    if caller_user_id is not null and new.status <> 'DRAFT' then
      raise exception 'booking_must_start_draft'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED' then
      raise exception 'booking_cannot_start_confirmed'
        using errcode = '23000';
    end if;

    if new.status in ('DRAFT', 'AWAITING_CUSTOMER', 'CONFIRMED') then
      new.started_at := null;
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'READY' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := coalesce(new.ready_at, v_now);
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'DELIVERED' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := coalesce(new.ready_at, v_now);
      new.delivered_at := coalesce(new.delivered_at, v_now);
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'COMPLETED' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := coalesce(new.ready_at, v_now);
      new.delivered_at := coalesce(new.delivered_at, v_now);
      new.completed_at := coalesce(new.completed_at, v_now);
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, v_now);
      new.completed_at := null;
      new.cancellation_reason := nullif(trim(coalesce(new.cancellation_reason, '')), '');
    end if;

    if new.status in ('DRAFT', 'AWAITING_CUSTOMER', 'CANCELLED') then
      new.customer_confirmed_at := null;
      new.confirmation_terms_hash := null;
      new.confirmation_terms_snapshot := null;
    end if;

    return new;
  end if;

  requested_status_change := old.status is distinct from new.status;
  material_changed := private.booking_material_terms_changed(old, new);

  if old.business_id is distinct from new.business_id then
    raise exception 'booking_business_id_immutable'
      using errcode = '23000';
  end if;

  if old.customer_id is distinct from new.customer_id then
    raise exception 'booking_customer_id_immutable'
      using errcode = '23000';
  end if;

  if old.reference is distinct from new.reference then
    raise exception 'booking_reference_immutable'
      using errcode = '23000';
  end if;

  if old.created_by is distinct from new.created_by then
    raise exception 'booking_created_by_immutable'
      using errcode = '23000';
  end if;

  if old.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'terminal_booking_locked'
      using errcode = '23000';
  end if;

  if requested_status_change and caller_user_id is not null and not transition_allowed then
    raise exception 'booking_status_transition_requires_controlled_operation'
      using errcode = '23000';
  end if;

  if old.scheduled_for is distinct from new.scheduled_for
    and old.status in ('AWAITING_CUSTOMER', 'CONFIRMED')
    and not reschedule_allowed
  then
    raise exception 'booking_reschedule_requires_controlled_operation'
      using errcode = '23000';
  end if;

  if material_changed and old.status = 'CONFIRMED'
    and not (
      reschedule_allowed
      and old.scheduled_for is distinct from new.scheduled_for
      and old.customer_id is not distinct from new.customer_id
      and old.title is not distinct from new.title
      and old.description is not distinct from new.description
      and old.currency is not distinct from new.currency
      and old.total_amount_minor is not distinct from new.total_amount_minor
      and old.deposit_amount_minor is not distinct from new.deposit_amount_minor
    )
  then
    raise exception 'customer_confirmed_material_terms_locked'
      using errcode = '23000';
  end if;

  if material_changed and old.status in ('IN_PROGRESS', 'READY', 'DELIVERED') then
    raise exception 'customer_confirmed_material_terms_locked'
      using errcode = '23000';
  end if;

  if material_changed and old.status = 'AWAITING_CUSTOMER' then
    revoked_count := private.revoke_open_confirmation_links(old.id, 'material_change');

    if revoked_count > 0 then
      insert into public.audit_logs (
        actor_user_id,
        business_id,
        event_type,
        metadata
      )
      values (
        caller_user_id,
        old.business_id,
        'BOOKING_CONFIRMATION_INVALIDATED',
        jsonb_build_object('booking_id', old.id, 'reason', 'material_change')
      );
    end if;
  end if;

  if material_changed and old.status = 'CONFIRMED' then
    new.status := 'AWAITING_CUSTOMER';
    new.customer_confirmed_at := null;
    new.confirmation_terms_hash := null;
    new.confirmation_terms_snapshot := null;
    perform private.revoke_open_confirmation_links(old.id, 'material_change');
    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      caller_user_id,
      old.business_id,
      'BOOKING_CONFIRMATION_INVALIDATED',
      jsonb_build_object('booking_id', old.id, 'reason', 'material_change')
    );
  end if;

  if old.status is distinct from new.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('AWAITING_CUSTOMER', 'CANCELLED'))
      or (old.status = 'AWAITING_CUSTOMER' and new.status = 'CANCELLED')
      or (old.status = 'AWAITING_CUSTOMER' and new.status = 'CONFIRMED' and caller_user_id is null)
      or (old.status = 'CONFIRMED' and new.status in ('AWAITING_CUSTOMER', 'IN_PROGRESS', 'CANCELLED'))
      or (old.status = 'IN_PROGRESS' and new.status in ('READY', 'CANCELLED'))
      or (old.status = 'READY' and new.status in ('DELIVERED', 'CANCELLED'))
      or (old.status = 'DELIVERED' and new.status = 'COMPLETED')
    ) then
      raise exception 'invalid_booking_status_transition'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED'
      and (new.customer_confirmed_at is null or new.confirmation_terms_hash is null or new.confirmation_terms_snapshot is null)
    then
      raise exception 'confirmed_booking_requires_terms_snapshot'
        using errcode = '23000';
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'READY' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := coalesce(old.ready_at, v_now);
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'DELIVERED' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := coalesce(old.ready_at, v_now);
      new.delivered_at := coalesce(old.delivered_at, v_now);
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'COMPLETED' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := coalesce(old.ready_at, v_now);
      new.delivered_at := coalesce(old.delivered_at, v_now);
      new.completed_at := coalesce(old.completed_at, v_now);
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(old.cancelled_at, v_now);
      new.completed_at := null;
      new.cancellation_reason := nullif(trim(coalesce(new.cancellation_reason, '')), '');
      perform private.revoke_open_confirmation_links(old.id, 'booking_cancelled');
    else
      new.started_at := null;
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    end if;
  else
    if old.started_at is distinct from new.started_at
      or old.ready_at is distinct from new.ready_at
      or old.delivered_at is distinct from new.delivered_at
      or old.cancelled_at is distinct from new.cancelled_at
      or old.completed_at is distinct from new.completed_at
      or old.cancellation_reason is distinct from new.cancellation_reason
    then
      raise exception 'operational_timestamps_follow_status'
        using errcode = '23000';
    end if;

    if old.customer_confirmed_at is distinct from new.customer_confirmed_at
      or old.confirmation_terms_hash is distinct from new.confirmation_terms_hash
      or old.confirmation_terms_snapshot is distinct from new.confirmation_terms_snapshot
    then
      raise exception 'confirmation_terms_follow_status'
        using errcode = '23000';
    end if;
  end if;

  return new;
end;
$$;

drop function public.transition_booking_status(uuid, public.booking_status, text);

create function public.transition_booking_status(
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

  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
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

  update public.bookings
  set status = p_to_status,
      cancellation_reason = case when p_to_status = 'CANCELLED' then clean_reason else null end
  where id = booking_row.id
  returning * into updated_row;

  if p_to_status = 'CANCELLED'
    and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
  then
    select *
    into confirmation_row
    from public.booking_confirmations
    where business_id = booking_row.business_id
      and booking_id = booking_row.id
    order by confirmed_at desc, id desc
    limit 1;

    cancellation_recipient := confirmation_row.contact_email;

    if cancellation_recipient is null then
      select lower(trim(email))
      into cancellation_recipient
      from public.customers
      where business_id = booking_row.business_id
        and id = booking_row.customer_id;
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
        select id
        into created_email_event_id
        from public.email_events
        where booking_confirmation_id = confirmation_row.id
          and event_type = 'BOOKING_CANCELLED';
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

revoke all on function private.booking_material_terms_changed(public.bookings, public.bookings)
from public, anon, authenticated;
revoke all on function private.enforce_booking_integrity()
from public, anon, authenticated;
revoke all on function public.transition_booking_status(uuid, public.booking_status, text)
from public, anon, authenticated;
grant execute on function public.transition_booking_status(uuid, public.booking_status, text)
to authenticated, service_role;
