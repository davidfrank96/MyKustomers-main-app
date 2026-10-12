-- Schedule-only operational updates retain immutable confirmation evidence.
-- Legacy unconfirmed/READY reconfirmation flows and all other material locks remain.
begin;

-- A schedule notice is keyed by the change, not by the original confirmation.
-- Keep the existing confirmation-event uniqueness rules unchanged.
alter table public.booking_confirmations add constraint booking_confirmations_tenant_booking_key unique(id,business_id,booking_id);
alter table public.email_events add column reschedule_confirmation_id uuid,
  add constraint email_events_reschedule_confirmation_fkey foreign key(reschedule_confirmation_id,business_id,booking_id)
    references public.booking_confirmations(id,business_id,booking_id) on delete cascade,
  add constraint email_events_reschedule_confirmation_check check (
    reschedule_confirmation_id is null or (event_type='BOOKING_RESCHEDULED' and booking_change_id is not null and confirmation_link_id is null and booking_confirmation_id is null));

create function private.has_current_booking_confirmation(p_booking public.bookings)
returns boolean language sql stable set search_path='' as $$
  select p_booking.status in ('CONFIRMED','IN_PROGRESS','READY')
    and p_booking.customer_confirmed_at is not null
    and p_booking.confirmation_terms_hash is not null
    and p_booking.confirmation_terms_snapshot is not null
    and exists(select 1 from public.booking_confirmations c
      where c.business_id=p_booking.business_id and c.booking_id=p_booking.id);
$$;
alter function private.has_current_booking_confirmation(public.bookings) owner to postgres;
revoke all on function private.has_current_booking_confirmation(public.bookings) from public,anon,authenticated,service_role;


alter table public.email_events
  drop constraint email_events_subject_check,
  add constraint email_events_subject_check
    check (
      (
        booking_confirmation_id is not null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and (
          event_type = 'BOOKING_DELIVERED'::public.email_event_type
          or (
            event_type in (
              'BOOKING_CONFIRMED'::public.email_event_type,
              'BOOKING_CANCELLED'::public.email_event_type
            )
            and feedback_link_id is null
          )
        )
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is not null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and feedback_link_id is null
        and event_type in (
          'BOOKING_AMENDMENT_REQUESTED'::public.email_event_type,
          'BOOKING_AMENDMENT_CONFIRMED'::public.email_event_type
        )
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is not null
        and booking_change_id is null
        and confirmation_link_id is null
        and feedback_link_id is null
        and event_type = 'BOOKING_ADDON_REQUESTED'::public.email_event_type
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and feedback_link_id is null
        and event_type = 'BOOKING_ADDON_CONFIRMED'::public.email_event_type
      )
      or (
        booking_confirmation_id is null
        and ((reschedule_confirmation_id is null and confirmation_link_id is not null)
          or (reschedule_confirmation_id is not null and confirmation_link_id is null))
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is not null
        and feedback_link_id is null
        and event_type = 'BOOKING_RESCHEDULED'::public.email_event_type
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is not null
        and feedback_link_id is null
        and event_type = 'BOOKING_CONFIRMATION_REQUESTED'::public.email_event_type
      )
    );


create or replace function private.enqueue_booking_communication(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.email_events; pref public.booking_communication_preferences; email_id uuid; source uuid;
begin
  e := jsonb_populate_record(null::public.email_events,p_data);
  select * into pref from public.booking_communication_preferences where booking_id=e.booking_id and business_id=e.business_id;
  if coalesce(pref.email_enabled,true) then
    -- Preserve the original email conflict targets and failure behavior.
    if e.event_type='BOOKING_ADDON_CONFIRMED' then
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,reschedule_confirmation_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.reschedule_confirmation_id,e.event_type,e.recipient_email)
    on conflict (booking_addon_id,event_type) where event_type='BOOKING_ADDON_CONFIRMED' do nothing returning id into email_id;
    elsif e.event_type='BOOKING_AMENDMENT_CONFIRMED' then
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,reschedule_confirmation_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.reschedule_confirmation_id,e.event_type,e.recipient_email)
    on conflict (booking_amendment_id,event_type) do nothing returning id into email_id;
    elsif e.event_type in ('BOOKING_CANCELLED','BOOKING_DELIVERED') then
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,reschedule_confirmation_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.reschedule_confirmation_id,e.event_type,e.recipient_email)
    on conflict (booking_confirmation_id,event_type) do nothing returning id into email_id;
    else
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,reschedule_confirmation_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.reschedule_confirmation_id,e.event_type,e.recipient_email)
    returning id into email_id;
    end if;
  end if;
  if pref.whatsapp_enabled and pref.disabled_at is null and private.has_business_feature(e.business_id,'WHATSAPP_CUSTOMER_UPDATES') and exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=e.business_id and p.enabled) then
    source := coalesce(e.booking_change_id,e.booking_addon_confirmation_link_id,e.booking_amendment_id,e.confirmation_link_id,e.booking_addon_id,e.booking_confirmation_id);
    if source is null then raise exception 'whatsapp_event_source_missing'; end if;
    insert into public.whatsapp_events(business_id,booking_id,event_type,source_id,capability_id,contact_hash,idempotency_key,recipient_e164)
    values(e.business_id,e.booking_id,e.event_type::text,source,coalesce(e.confirmation_link_id,e.booking_addon_confirmation_link_id,e.booking_amendment_id),encode(extensions.digest(e.recipient_email,'sha256'),'hex'),
      encode(extensions.digest(concat_ws('|','whatsapp-v1',e.business_id,e.booking_id,e.event_type,source),'sha256'),'hex'),pref.recipient_e164)
    on conflict(business_id,booking_id,event_type,source_id) do nothing;
  end if;
  return email_id;
end $$;

CREATE OR REPLACE FUNCTION public.reschedule_booking(p_booking_id uuid, p_scheduled_for timestamp with time zone) RETURNS TABLE(booking_id uuid, previous_scheduled_for timestamp with time zone, new_scheduled_for timestamp with time zone, status public.booking_status)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  updated_row public.bookings;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_scheduled_for is null or p_scheduled_for <= now() then
    raise exception 'scheduled_for_must_be_future'
      using errcode = '22023';
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

  if booking_row.status not in (
    'DRAFT',
    'AWAITING_CUSTOMER',
    'CONFIRMED',
    'IN_PROGRESS',
    'READY'
  ) then
    raise exception 'booking_not_eligible_for_reschedule'
      using errcode = '23000';
  end if;

  if booking_row.scheduled_for is not distinct from p_scheduled_for then
    raise exception 'booking_schedule_unchanged'
      using errcode = '22023';
  end if;

  perform set_config('app.booking_reschedule_allowed', 'true', true);

  update public.bookings as booking
  set scheduled_for = p_scheduled_for
  where booking.id = booking_row.id
  returning booking.* into updated_row;

  perform set_config('app.booking_reschedule_allowed', 'false', true);
  perform set_config('app.booking_operational_reschedule_allowed', 'false', true);

  perform private.revoke_pending_booking_amendments(
    booking_row.id,
    'booking_rescheduled',
    caller_user_id
  );

  insert into public.booking_changes (
    business_id,
    booking_id,
    changed_by,
    change_type,
    previous_scheduled_for,
    new_scheduled_for
  )
  values (
    booking_row.business_id,
    booking_row.id,
    caller_user_id,
    'reschedule',
    booking_row.scheduled_for,
    p_scheduled_for
  );

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    'BOOKING_RESCHEDULED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'previous_scheduled_for', booking_row.scheduled_for,
      'new_scheduled_for', p_scheduled_for,
      'confirmation_invalidated',
        booking_row.customer_confirmed_at is not null and updated_row.customer_confirmed_at is null
    )
  );

  return query
  select
    updated_row.id,
    booking_row.scheduled_for,
    updated_row.scheduled_for,
    updated_row.status;
end;
$$;

CREATE OR REPLACE FUNCTION private.enforce_booking_integrity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  material_changed boolean := false;
  requested_status_change boolean := false;
  transition_allowed boolean := false;
  reschedule_allowed boolean := false;
  amendment_allowed boolean := false;
  operational_reschedule boolean := false;
  revoked_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  caller_user_id := auth.uid();
  transition_allowed := coalesce(
    current_setting('app.booking_transition_allowed', true),
    'false'
  ) = 'true';
  reschedule_allowed := coalesce(
    current_setting('app.booking_reschedule_allowed', true),
    'false'
  ) = 'true';
  amendment_allowed := coalesce(
    current_setting('app.booking_amendment_allowed', true),
    'false'
  ) = 'true';

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
  operational_reschedule := coalesce(current_setting('app.booking_operational_reschedule_allowed',true),'false')='true'
    and reschedule_allowed
    and private.has_current_booking_confirmation(old)
    and old.status is not distinct from new.status
    and old.scheduled_for is distinct from new.scheduled_for
    and old.customer_id is not distinct from new.customer_id
    and old.title is not distinct from new.title
    and old.description is not distinct from new.description
    and old.currency is not distinct from new.currency
    and old.total_amount_minor is not distinct from new.total_amount_minor
    and old.deposit_amount_minor is not distinct from new.deposit_amount_minor
    and old.customer_confirmed_at is not distinct from new.customer_confirmed_at
    and old.confirmation_terms_hash is not distinct from new.confirmation_terms_hash
    and old.confirmation_terms_snapshot is not distinct from new.confirmation_terms_snapshot;


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
    and old.status in ('AWAITING_CUSTOMER', 'CONFIRMED', 'IN_PROGRESS', 'READY')
    and not reschedule_allowed
    and not amendment_allowed
  then
    raise exception 'booking_reschedule_requires_controlled_operation'
      using errcode = '23000';
  end if;

  if material_changed and old.status = 'CONFIRMED'
    and not amendment_allowed
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

  if material_changed
    and old.status in ('IN_PROGRESS', 'READY', 'DELIVERED')
    and not (amendment_allowed and old.status = 'IN_PROGRESS')
    and not (
      reschedule_allowed
      and old.status in ('IN_PROGRESS', 'READY')
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

  if amendment_allowed and old.status not in ('CONFIRMED', 'IN_PROGRESS') then
    raise exception 'booking_not_eligible_for_amendment'
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

  if material_changed
    and old.status in ('CONFIRMED', 'IN_PROGRESS', 'READY')
    and not amendment_allowed
    and not operational_reschedule
  then
    -- Finished work stays READY while the changed schedule awaits confirmation.
    new.status := case when old.status = 'READY' then 'READY'::public.booking_status
      else 'AWAITING_CUSTOMER'::public.booking_status end;
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

  -- Preserve the existing reconfirmation requirement without moving completed work backward.
  if old.status = 'READY' and new.status = 'DELIVERED'
    and old.confirmation_terms_hash is null
  then
    raise exception 'booking_reconfirmation_required' using errcode = '23000';
  end if;

  if old.status is distinct from new.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('AWAITING_CUSTOMER', 'CANCELLED'))
      or (old.status = 'AWAITING_CUSTOMER' and new.status = 'CANCELLED')
      or (
        old.status = 'AWAITING_CUSTOMER'
        and new.status = 'CONFIRMED'
        and caller_user_id is null
      )
      or (
        old.status = 'CONFIRMED'
        and new.status in ('AWAITING_CUSTOMER', 'IN_PROGRESS', 'CANCELLED')
      )
      or (
        old.status = 'IN_PROGRESS'
        and new.status = 'AWAITING_CUSTOMER'
        and reschedule_allowed
      )
      or (old.status = 'IN_PROGRESS' and new.status in ('READY', 'CANCELLED'))
      or (old.status = 'READY' and new.status in ('DELIVERED', 'CANCELLED'))
      or (old.status = 'DELIVERED' and new.status = 'COMPLETED')
    ) then
      raise exception 'invalid_booking_status_transition'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED'
      and (
        new.customer_confirmed_at is null
        or new.confirmation_terms_hash is null
        or new.confirmation_terms_snapshot is null
      )
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

    if not amendment_allowed
      and not (
        old.status = 'READY' and new.status = 'READY'
        and (
          (reschedule_allowed and material_changed
            and new.customer_confirmed_at is null
            and new.confirmation_terms_hash is null
            and new.confirmation_terms_snapshot is null)
          or (caller_user_id is null and not material_changed
            and coalesce(current_setting('app.booking_ready_reconfirmation_allowed', true), 'false') = 'true'
            and old.confirmation_terms_hash is null
            and new.customer_confirmed_at is not null
            and new.confirmation_terms_hash is not null
            and new.confirmation_terms_snapshot is not null)
        )
      )
      and (
        old.customer_confirmed_at is distinct from new.customer_confirmed_at
        or old.confirmation_terms_hash is distinct from new.confirmation_terms_hash
        or old.confirmation_terms_snapshot is distinct from new.confirmation_terms_snapshot
      )
    then
      raise exception 'confirmation_terms_follow_status'
        using errcode = '23000';
    end if;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_booking_update(p_booking_id uuid, p_scheduled_for timestamp with time zone, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_id uuid, previous_scheduled_for timestamp with time zone, new_scheduled_for timestamp with time zone, status public.booking_status, confirmation_link_id uuid, expires_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_user_id uuid := auth.uid();
  reschedule_result record;
  booking_row public.bookings;
  confirmation_row public.booking_confirmations;
  change_row public.booking_changes;
  notification_recipient text;
  created_confirmation_link_id uuid;
  created_email_event_id uuid;
  operational_update boolean;
  email_selected boolean;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  -- Lock and classify before mutation. This also serializes identical retries.
  select * into booking_row from public.bookings b where b.id=p_booking_id for update;
  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode='42501';
  end if;
  operational_update := private.has_current_booking_confirmation(booking_row);
  perform set_config('app.booking_operational_reschedule_allowed',operational_update::text,true);
  if not operational_update then
    if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'invalid_token_hash' using errcode='22023';
    end if;
    if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '48 hours' then
      raise exception 'confirmation_link_expiration_invalid' using errcode='22023';
    end if;
  end if;
  select coalesce((select p.email_enabled from public.booking_communication_preferences p
    where p.business_id=booking_row.business_id and p.booking_id=booking_row.id),true) into email_selected;

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
    and (not operational_update or not email_selected or confirmation.contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  order by confirmation.confirmed_at desc, confirmation.id desc
  limit 1;

  if confirmation_row.id is not null then
    notification_recipient := private.normalize_customer_contact_email(
      confirmation_row.contact_email
    );
  end if;

  if operational_update and email_selected and notification_recipient is null then
    raise exception 'booking_confirmation_contact_unavailable' using errcode='23000';
  end if;

  if operational_update or (confirmation_row.id is not null and notification_recipient is not null) then
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
      raise exception 'reschedule_change_evidence_unavailable' using errcode = '23000';
    end if;

    if not operational_update then
    insert into public.confirmation_links (
      business_id, booking_id, token_hash, expires_at, created_by
    )
    values (
      booking_row.business_id, booking_row.id, p_token_hash,
      p_expires_at, caller_user_id
    )
    returning id into created_confirmation_link_id;

    end if;

    created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_change_id', change_row.id,
      'reschedule_confirmation_id', case when operational_update then confirmation_row.id end,
      'confirmation_link_id', created_confirmation_link_id,
      'event_type', 'BOOKING_RESCHEDULED',
      'recipient_email', notification_recipient
    ));

    if not operational_update then
    insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
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
$function$
;

CREATE OR REPLACE FUNCTION public.reschedule_booking_update_with_channels(p_booking_id uuid, p_scheduled_for timestamp with time zone, p_capability_token text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_id uuid, previous_scheduled_for timestamp with time zone, new_scheduled_for timestamp with time zone, status public.booking_status, confirmation_link_id uuid, expires_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_capability_token is not null and p_capability_token !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'invalid_capability'; end if;
  select * into r from public.reschedule_booking_update(p_booking_id, p_scheduled_for, encode(extensions.digest(p_capability_token,'sha256'),'hex'), p_expires_at);
  if r.confirmation_link_id is not null then
    perform private.capture_whatsapp_capability(p_booking_id,p_capability_token);
  end if;
  return query select r.booking_id, r.previous_scheduled_for, r.new_scheduled_for, r.status, r.confirmation_link_id, r.expires_at, r.email_event_id;
end;
$function$;

create or replace function public.get_whatsapp_dispatch_context(p_event_id uuid,p_lease_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.whatsapp_events; b public.bookings; business_name text; c private.whatsapp_capabilities; link record; token text; schedule_change public.booking_changes;
begin
  select * into e from public.whatsapp_events where id=p_event_id and lease_id=p_lease_id and status='PROCESSING' and lease_expires_at>now();
  if not found then return null; end if;
  if not exists(select 1 from public.booking_communication_preferences p where p.booking_id=e.booking_id and p.whatsapp_enabled and p.disabled_at is null)
    or not private.has_business_feature(e.business_id,'WHATSAPP_CUSTOMER_UPDATES')
    or not exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=e.business_id and p.enabled) then return null; end if;
  select * into strict b from public.bookings where id=e.booking_id and business_id=e.business_id;
  select name into strict business_name from public.businesses where id=e.business_id;
  select * into c from private.whatsapp_capabilities where event_id=e.id;
  if e.event_type='BOOKING_RESCHEDULED' and e.capability_id is null then
    select * into schedule_change from public.booking_changes bc
      where bc.id=e.source_id and bc.business_id=e.business_id and bc.booking_id=e.booking_id
        and bc.change_type='reschedule';
    if not found or e.created_at<now()-interval '48 hours' or not exists(
      select 1 from public.booking_confirmations bc where bc.business_id=e.business_id
        and bc.booking_id=e.booking_id
    ) then return null; end if;
    return jsonb_build_object('event_type',e.event_type,'business_name',business_name,
      'booking_reference',b.reference,'recipient',e.recipient_e164,'path_prefix',null,'token',null,
      'schedule_update',jsonb_build_object('previous',schedule_change.previous_scheduled_for,'next',schedule_change.new_scheduled_for));
  end if;
  if e.event_type in ('BOOKING_CONFIRMATION_REQUESTED','BOOKING_RESCHEDULED','BOOKING_AMENDMENT_REQUESTED','BOOKING_ADDON_REQUESTED','BOOKING_DELIVERED') then
    if c.event_id is null or c.expires_at<=now() or e.created_at<now()-interval '48 hours' then return null; end if;
    if e.event_type<>'BOOKING_DELIVERED' and not exists(select 1 from private.whatsapp_link_context(e) l where l.token_hash=c.token_hash and l.valid and l.expires_at>now()) then return null; end if;
    if e.event_type='BOOKING_DELIVERED' and not exists(select 1 from public.feedback_links f where f.business_id=e.business_id and f.booking_id=e.booking_id and f.token_hash=c.token_hash and f.revoked_at is null and f.used_at is null and f.expires_at>now()) then return null; end if;
    token:=extensions.pgp_sym_decrypt(c.ciphertext,private.whatsapp_capability_key());
    if encode(extensions.digest(token,'sha256'),'hex')<>c.token_hash then raise exception 'capability_integrity'; end if;
  end if;
  return jsonb_build_object('event_type',e.event_type,'business_name',business_name,'booking_reference',b.reference,'recipient',e.recipient_e164,'path_prefix',c.path_prefix,'token',token);
end $$;


alter function public.reschedule_booking(uuid,timestamptz) owner to postgres;
revoke all on function public.reschedule_booking(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.reschedule_booking(uuid,timestamptz) to authenticated;
alter function private.enforce_booking_integrity() owner to postgres;
revoke all on function private.enforce_booking_integrity() from public,anon,authenticated,service_role;
alter function public.reschedule_booking_update(uuid,timestamptz,text,timestamptz) owner to postgres;
revoke all on function public.reschedule_booking_update(uuid,timestamptz,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reschedule_booking_update(uuid,timestamptz,text,timestamptz) to authenticated;
alter function public.reschedule_booking_update_with_channels(uuid,timestamptz,text,timestamptz) owner to postgres;
revoke all on function public.reschedule_booking_update_with_channels(uuid,timestamptz,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reschedule_booking_update_with_channels(uuid,timestamptz,text,timestamptz) to authenticated;
alter function public.get_whatsapp_dispatch_context(uuid,uuid) owner to postgres;
revoke all on function public.get_whatsapp_dispatch_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_whatsapp_dispatch_context(uuid,uuid) to service_role;
commit;
