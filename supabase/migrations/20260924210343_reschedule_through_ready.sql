-- READY schedule changes preserve operational completion while reusing the
-- existing reconfirmation capability, history and channel outboxes.
-- Replacing only reschedule_booking is insufficient: the integrity trigger locks
-- READY terms and confirmation read/write functions accept only AWAITING_CUSTOMER.
-- Existing function ACLs, tenant checks and capability checks are preserved.

begin;

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
        booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY')
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

CREATE OR REPLACE FUNCTION public.confirm_booking_by_token_hash(p_token_hash text, p_contact_email text, p_contact_phone text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  link_row public.confirmation_links;
  booking_row public.bookings;
  customer_row public.customers;
  business_row public.businesses;
  snapshot jsonb;
  terms_hash text;
  normalized_contact_email text := private.normalize_customer_contact_email(p_contact_email);
  normalized_contact_phone text := nullif(trim(p_contact_phone), '');
  confirmation_id uuid;
  email_event_id uuid;
  confirmed_time timestamptz := clock_timestamp();
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if normalized_contact_email is null
    or char_length(normalized_contact_email) > 254
    or normalized_contact_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    return jsonb_build_object('status', 'invalid_contact');
  end if;

  if normalized_contact_phone is not null
    and (
      char_length(normalized_contact_phone) not between 7 and 32
      or normalized_contact_phone !~ '^[0-9+().[:space:]-]+$'
    )
  then
    return jsonb_build_object('status', 'invalid_contact');
  end if;

  select link.*
  into link_row
  from public.confirmation_links as link
  where link.token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = link_row.booking_id
    and booking.business_id = link_row.business_id
  for update;

  if not found or booking_row.status in ('CANCELLED', 'COMPLETED') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.used_at is not null then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'business_id', link_row.business_id,
      'booking_id', link_row.booking_id
    );
  end if;

  if link_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= confirmed_time then
    return jsonb_build_object('status', 'expired');
  end if;

  if booking_row.status <> 'AWAITING_CUSTOMER'
    and not (booking_row.status = 'READY' and booking_row.confirmation_terms_hash is null)
  then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  select customer.*
  into customer_row
  from public.customers as customer
  where customer.id = booking_row.customer_id
    and customer.business_id = booking_row.business_id
  for update;

  select business.*
  into business_row
  from public.businesses as business
  where business.id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);
  terms_hash := private.booking_terms_hash(snapshot);

  -- Confirmation contact is booking-scoped evidence. Never enrich profile email.
  if normalized_contact_phone is not null
    and nullif(trim(customer_row.phone), '') is null
  then
    update public.customers as customer
    set phone = normalized_contact_phone
    where customer.id = customer_row.id
      and nullif(trim(customer.phone), '') is null;
  end if;

  -- This narrow flag is set only after the existing locked capability checks.
  perform set_config('app.booking_ready_reconfirmation_allowed',
    (booking_row.status = 'READY')::text, true);
  update public.bookings as booking
  set status = case when booking_row.status = 'READY' then 'READY'::public.booking_status
        else 'CONFIRMED'::public.booking_status end,
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = terms_hash,
      confirmation_terms_snapshot = snapshot
  where booking.id = booking_row.id;

  perform set_config('app.booking_ready_reconfirmation_allowed', 'false', true);

  update public.confirmation_links as link
  set used_at = confirmed_time
  where link.id = link_row.id;

  insert into public.booking_confirmations (
    business_id,
    booking_id,
    confirmation_link_id,
    terms_hash,
    terms_snapshot,
    contact_email,
    contact_phone,
    confirmed_at
  )
  values (
    booking_row.business_id,
    booking_row.id,
    link_row.id,
    terms_hash,
    snapshot,
    normalized_contact_email,
    normalized_contact_phone,
    confirmed_time
  )
  returning id into confirmation_id;

  email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_confirmation_id', confirmation_id,
      'event_type', 'BOOKING_CONFIRMED',
      'recipient_email', normalized_contact_email
    ));

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    booking_row.business_id,
    'BOOKING_CONFIRMED_BY_CUSTOMER',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_link_id', link_row.id,
      'terms_hash', terms_hash,
      'confirmation_id', confirmation_id,
      'email_event_id', email_event_id,
      'contact_captured', true,
      'phone_provided', normalized_contact_phone is not null,
      'operational_status', case when booking_row.status = 'READY' then 'READY' else 'IN_PROGRESS' end
    )
  );

  if booking_row.status <> 'READY' then
  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings as booking
  set status = 'IN_PROGRESS'
  where booking.id = booking_row.id
    and booking.status = 'CONFIRMED';

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    booking_row.business_id,
    'BOOKING_STATUS_CHANGED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'from_status', 'CONFIRMED',
      'to_status', 'IN_PROGRESS',
      'automatic_after_confirmation', true
    )
  );

  end if;

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'confirmed_at', confirmed_time,
    'terms_hash', terms_hash,
    'email_event_id', email_event_id,
    'operational_status', case when booking_row.status = 'READY' then 'READY' else 'IN_PROGRESS' end
  );
end;
$_$;

CREATE OR REPLACE FUNCTION public.get_confirmation_public_view(p_token_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $_$
declare
  link_row public.confirmation_links;
  booking_status public.booking_status;
  confirmation_row public.booking_confirmations;
  business_row public.businesses;
  view_data jsonb;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into link_row
  from public.confirmation_links
  where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select status
  into booking_status
  from public.bookings
  where id = link_row.booking_id
    and business_id = link_row.business_id;

  if booking_status is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.used_at is not null then
    select *
    into confirmation_row
    from public.booking_confirmations
    where confirmation_link_id = link_row.id;

    if not found then
      return jsonb_build_object('status', 'already_confirmed');
    end if;

    select *
    into business_row
    from public.businesses
    where id = link_row.business_id;

    return jsonb_build_object(
      'status', 'already_confirmed',
      'booking', jsonb_build_object(
        'business_name', confirmation_row.terms_snapshot ->> 'business_name',
        'business_logo_path', business_row.logo_path,
        'business_website', business_row.website,
        'business_instagram', business_row.instagram,
        'business_phone', null,
        'business_email', null,
        'customer_name', confirmation_row.terms_snapshot ->> 'customer_name',
        'booking_reference', confirmation_row.terms_snapshot ->> 'booking_reference',
        'booking_title', confirmation_row.terms_snapshot ->> 'title',
        'booking_description', confirmation_row.terms_snapshot ->> 'description',
        'scheduled_for', confirmation_row.terms_snapshot ->> 'scheduled_for',
        'currency', confirmation_row.terms_snapshot ->> 'currency',
        'total_amount_minor', (confirmation_row.terms_snapshot ->> 'total_amount_minor')::bigint,
        'deposit_amount_minor', (confirmation_row.terms_snapshot ->> 'deposit_amount_minor')::bigint,
        'balance_amount_minor', (confirmation_row.terms_snapshot ->> 'balance_amount_minor')::bigint,
        'status', booking_status,
        'expires_at', link_row.expires_at,
        'confirmed_at', confirmation_row.confirmed_at,
        'terms_hash', confirmation_row.terms_hash,
        'contact_email_masked', private.mask_contact_email(confirmation_row.contact_email)
      )
    );
  end if;

  if booking_status in ('CANCELLED', 'COMPLETED') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  view_data := private.customer_confirmation_view(link_row);

  if view_data is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if booking_status <> 'AWAITING_CUSTOMER'
    and not (booking_status = 'READY' and exists (
      select 1 from public.bookings as booking
      where booking.id = link_row.booking_id
        and booking.business_id = link_row.business_id
        and booking.confirmation_terms_hash is null
    ))
  then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  return jsonb_build_object('status', 'valid', 'booking', view_data);
end;
$_$;

commit;
