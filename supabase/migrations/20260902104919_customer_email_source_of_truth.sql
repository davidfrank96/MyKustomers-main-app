-- Approved customer email source-of-truth migration.
-- Customer saved email remains optional profile data.
-- Booking confirmation contact is the sole automatic communication recipient.
-- Missing booking contact produces no email event; manual sharing remains available.

begin;

do $precheck$
begin
  if to_regprocedure('private.normalize_customer_contact_email(text)') is null
    or to_regprocedure('public.confirm_booking_by_token_hash(text,text,text)') is null
    or to_regprocedure('public.create_booking_amendment(uuid,text,text,text,public.booking_currency,bigint,bigint,timestamptz,text,timestamptz)') is null
    or to_regprocedure('public.reschedule_booking_with_notification(uuid,timestamptz,text,timestamptz)') is null
    or to_regprocedure('public.transition_booking_status(uuid,public.booking_status,text)') is null
    or to_regprocedure('public.submit_booking_addon(uuid,text,timestamptz)') is null
    or to_regprocedure('public.deliver_booking_with_feedback(uuid)') is null
    or to_regprocedure('private.enforce_new_delivery_transaction()') is null
  then
    raise exception 'customer_email_source_of_truth_precheck_failed';
  end if;
end;
$precheck$;

create or replace function public.confirm_booking_by_token_hash(
  p_token_hash text,
  p_contact_email text,
  p_contact_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  if booking_row.status <> 'AWAITING_CUSTOMER' then
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

  update public.bookings as booking
  set status = 'CONFIRMED',
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = terms_hash,
      confirmation_terms_snapshot = snapshot
  where booking.id = booking_row.id;

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
    confirmation_id,
    'BOOKING_CONFIRMED',
    normalized_contact_email
  )
  returning id into email_event_id;

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
      'operational_status', 'IN_PROGRESS'
    )
  );

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

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'confirmed_at', confirmed_time,
    'terms_hash', terms_hash,
    'email_event_id', email_event_id,
    'operational_status', 'IN_PROGRESS'
  );
end;
$$;

alter function public.confirm_booking_by_token_hash(text, text, text)
owner to postgres;
revoke all on function public.confirm_booking_by_token_hash(text, text, text)
from public, anon, authenticated;
grant execute on function public.confirm_booking_by_token_hash(text, text, text)
to service_role;

create or replace function public.create_booking_amendment(
  p_booking_id uuid,
  p_reason text,
  p_title text,
  p_description text,
  p_currency public.booking_currency,
  p_total_amount_minor bigint,
  p_deposit_amount_minor bigint,
  p_scheduled_for timestamptz,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '24 hours'
)
returns table (
  amendment_id uuid,
  expires_at timestamptz,
  replaced_amendment_count integer,
  email_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  confirmation_row public.booking_confirmations;
  customer_email text;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
  clean_description text := nullif(trim(coalesce(p_description, '')), '');
  old_snapshot jsonb;
  proposed_snapshot jsonb;
  proposed_hash text;
  changed text[] := array[]::text[];
  created_amendment_id uuid;
  created_email_event_id uuid;
  replaced_count integer;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'amendment_expiration_invalid' using errcode = '22023';
  end if;
  if clean_reason is null or char_length(clean_reason) > 500 then
    raise exception 'amendment_reason_required' using errcode = '22023';
  end if;
  if clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>' then
    raise exception 'amendment_reason_must_be_plain_text' using errcode = '22023';
  end if;
  if clean_title is null or char_length(clean_title) > 160 then
    raise exception 'amendment_title_invalid' using errcode = '22023';
  end if;
  if clean_description is not null and char_length(clean_description) > 5000 then
    raise exception 'amendment_description_too_long' using errcode = '22023';
  end if;
  if p_total_amount_minor < 0
    or p_deposit_amount_minor < 0
    or p_deposit_amount_minor > p_total_amount_minor
  then
    raise exception 'amendment_amounts_invalid' using errcode = '22023';
  end if;
  if p_scheduled_for is not null and p_scheduled_for <= now() then
    raise exception 'amendment_schedule_must_be_future' using errcode = '22023';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;
  if booking_row.status not in ('CONFIRMED', 'IN_PROGRESS')
    or booking_row.confirmation_terms_hash is null
    or booking_row.confirmation_terms_snapshot is null
  then
    raise exception 'booking_not_eligible_for_amendment' using errcode = '23000';
  end if;

  old_snapshot := booking_row.confirmation_terms_snapshot;
  if booking_row.title is distinct from clean_title then
    changed := array_append(changed, 'title');
  end if;
  if booking_row.description is distinct from clean_description then
    changed := array_append(changed, 'description');
  end if;
  if booking_row.currency is distinct from p_currency then
    changed := array_append(changed, 'currency');
  end if;
  if booking_row.total_amount_minor is distinct from p_total_amount_minor then
    changed := array_append(changed, 'total_amount_minor');
  end if;
  if booking_row.deposit_amount_minor is distinct from p_deposit_amount_minor then
    changed := array_append(changed, 'deposit_amount_minor');
  end if;
  if booking_row.scheduled_for is distinct from p_scheduled_for then
    changed := array_append(changed, 'scheduled_for');
  end if;
  if cardinality(changed) = 0 then
    raise exception 'amendment_has_no_changes' using errcode = '22023';
  end if;

  proposed_snapshot := old_snapshot || jsonb_build_object(
    'title', clean_title,
    'description', clean_description,
    'currency', p_currency,
    'total_amount_minor', p_total_amount_minor,
    'deposit_amount_minor', p_deposit_amount_minor,
    'balance_amount_minor', p_total_amount_minor - p_deposit_amount_minor,
    'scheduled_for', p_scheduled_for
  );
  proposed_hash := private.booking_terms_hash(proposed_snapshot);

  select confirmation.*
  into confirmation_row
  from public.booking_confirmations as confirmation
  where confirmation.business_id = booking_row.business_id
    and confirmation.booking_id = booking_row.id
  order by confirmation.confirmed_at desc, confirmation.id desc
  limit 1;

  customer_email := private.normalize_customer_contact_email(
    confirmation_row.contact_email
  );
  if customer_email is null then
    raise exception 'amendment_contact_unavailable' using errcode = '23000';
  end if;

  replaced_count := private.revoke_pending_booking_amendments(
    booking_row.id,
    'replaced',
    caller_user_id
  );

  insert into public.booking_amendments (
    business_id, booking_id, token_hash, expires_at, reason,
    base_terms_hash, old_terms, proposed_terms, proposed_terms_hash,
    changed_fields, contact_email, contact_phone, proposed_by
  )
  values (
    booking_row.business_id, booking_row.id, p_token_hash, p_expires_at,
    clean_reason, booking_row.confirmation_terms_hash, old_snapshot,
    proposed_snapshot, proposed_hash, changed, customer_email,
    confirmation_row.contact_phone, caller_user_id
  )
  returning id into created_amendment_id;

  insert into public.email_events (
    business_id, booking_id, customer_id, booking_amendment_id,
    event_type, recipient_email
  )
  values (
    booking_row.business_id, booking_row.id, booking_row.customer_id,
    created_amendment_id, 'BOOKING_AMENDMENT_REQUESTED', customer_email
  )
  returning id into created_email_event_id;

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    caller_user_id,
    booking_row.business_id,
    'BOOKING_AMENDMENT_SUBMITTED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'amendment_id', created_amendment_id,
      'changed_fields', to_jsonb(changed),
      'base_terms_hash', booking_row.confirmation_terms_hash,
      'proposed_terms_hash', proposed_hash,
      'expires_at', p_expires_at,
      'replaced_amendment_count', replaced_count,
      'email_event_id', created_email_event_id
    )
  );

  return query
  select created_amendment_id, p_expires_at, replaced_count, created_email_event_id;
end;
$$;

alter function public.create_booking_amendment(
  uuid, text, text, text, public.booking_currency, bigint, bigint,
  timestamptz, text, timestamptz
) owner to postgres;
revoke all on function public.create_booking_amendment(
  uuid, text, text, text, public.booking_currency, bigint, bigint,
  timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_booking_amendment(
  uuid, text, text, text, public.booking_currency, bigint, bigint,
  timestamptz, text, timestamptz
) to authenticated;

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
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'confirmation_link_expiration_invalid' using errcode = '22023';
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
    notification_recipient := private.normalize_customer_contact_email(
      confirmation_row.contact_email
    );
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
      raise exception 'reschedule_change_evidence_unavailable' using errcode = '23000';
    end if;

    insert into public.confirmation_links (
      business_id, booking_id, token_hash, expires_at, created_by
    )
    values (
      booking_row.business_id, booking_row.id, p_token_hash,
      p_expires_at, caller_user_id
    )
    returning id into created_confirmation_link_id;

    insert into public.email_events (
      business_id, booking_id, customer_id, booking_change_id,
      confirmation_link_id, event_type, recipient_email
    )
    values (
      booking_row.business_id, booking_row.id, booking_row.customer_id,
      change_row.id, created_confirmation_link_id,
      'BOOKING_RESCHEDULED', notification_recipient
    )
    returning id into created_email_event_id;

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

alter function public.reschedule_booking_with_notification(
  uuid, timestamptz, text, timestamptz
) owner to postgres;
revoke all on function public.reschedule_booking_with_notification(
  uuid, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.reschedule_booking_with_notification(
  uuid, timestamptz, text, timestamptz
) to authenticated;

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
  payment_totals record;
  clean_reason text;
  notification_recipient text;
  created_email_event_id uuid;
  v_changed_at timestamptz := clock_timestamp();
  audit_type public.audit_event_type;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;
  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;
  if booking_row.status = p_to_status then
    raise exception 'booking_already_in_target_status' using errcode = '23000';
  end if;

  clean_reason := nullif(trim(coalesce(p_cancellation_reason, '')), '');
  if p_to_status = 'CANCELLED'
    and clean_reason is not null
    and char_length(clean_reason) > 500
  then
    raise exception 'cancellation_reason_too_long' using errcode = '22023';
  end if;
  if p_to_status = 'CANCELLED'
    and clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'
  then
    raise exception 'cancellation_reason_must_be_plain_text' using errcode = '22023';
  end if;
  if p_to_status = 'CANCELLED'
    and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    and clean_reason is null
  then
    raise exception 'cancellation_reason_required' using errcode = '22023';
  end if;
  if p_to_status <> 'CANCELLED' and clean_reason is not null then
    raise exception 'cancellation_reason_only_allowed_for_cancellation' using errcode = '22023';
  end if;

  if booking_row.status = 'DELIVERED' and p_to_status = 'COMPLETED' then
    select *
    into payment_totals
    from private.booking_payment_totals(booking_row.business_id, booking_row.id);
    if payment_totals.outstanding_amount_minor > 0 then
      raise exception 'outstanding_balance' using errcode = '23514';
    end if;
  end if;

  perform set_config('app.booking_transition_allowed', 'true', true);
  update public.bookings as booking
  set status = p_to_status,
      cancellation_reason = case
        when p_to_status = 'CANCELLED' then clean_reason
        else null
      end
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

    notification_recipient := private.normalize_customer_contact_email(
      confirmation_row.contact_email
    );

    if confirmation_row.id is not null and notification_recipient is not null then
      insert into public.email_events (
        business_id, booking_id, customer_id, booking_confirmation_id,
        event_type, recipient_email
      )
      values (
        booking_row.business_id,
        booking_row.id,
        booking_row.customer_id,
        confirmation_row.id,
        case
          when p_to_status = 'DELIVERED' then 'BOOKING_DELIVERED'::public.email_event_type
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
            when p_to_status = 'DELIVERED' then 'BOOKING_DELIVERED'::public.email_event_type
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
  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
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
  select updated_row.id, booking_row.status, updated_row.status,
    v_changed_at, created_email_event_id;
end;
$$;

alter function public.transition_booking_status(
  uuid, public.booking_status, text
) owner to postgres;
revoke all on function public.transition_booking_status(
  uuid, public.booking_status, text
) from public, anon, authenticated;
grant execute on function public.transition_booking_status(
  uuid, public.booking_status, text
) to authenticated;

create or replace function public.submit_booking_addon(
  p_booking_addon_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '24 hours'
)
returns table (
  booking_addon_id uuid,
  confirmation_link_id uuid,
  expires_at timestamptz,
  replaced_link_count integer,
  email_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  addon_row public.booking_addons;
  booking_row public.bookings;
  confirmation_row public.booking_confirmations;
  business_name text;
  customer_email text;
  snapshot jsonb;
  snapshot_hash text;
  created_link_id uuid;
  created_email_event_id uuid;
  replaced_count integer;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'booking_addon_expiration_invalid' using errcode = '22023';
  end if;

  select addon.*
  into addon_row
  from public.booking_addons as addon
  where addon.id = p_booking_addon_id
  for update;
  if not found or not private.is_business_member(addon_row.business_id) then
    raise exception 'booking_addon_not_found_or_unauthorized' using errcode = '42501';
  end if;
  if addon_row.status not in ('DRAFT', 'AWAITING_CUSTOMER') then
    raise exception 'booking_addon_not_submittable' using errcode = '23000';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = addon_row.booking_id
    and booking.business_id = addon_row.business_id
  for update;
  if not found or booking_row.status not in ('CONFIRMED', 'IN_PROGRESS') then
    raise exception 'booking_not_eligible_for_addon' using errcode = '23000';
  end if;
  if addon_row.currency is distinct from booking_row.currency then
    raise exception 'booking_addon_currency_mismatch' using errcode = '23000';
  end if;
  if exists (
    select 1 from public.booking_amendments as amendment
    where amendment.booking_id = booking_row.id
      and amendment.status = 'PENDING_CUSTOMER'
  ) then
    raise exception 'booking_has_pending_amendment_request' using errcode = '23000';
  end if;
  if exists (
    select 1 from public.booking_addons as other_addon
    where other_addon.booking_id = booking_row.id
      and other_addon.status = 'AWAITING_CUSTOMER'
      and other_addon.id <> addon_row.id
  ) then
    raise exception 'booking_has_pending_addon_request' using errcode = '23000';
  end if;

  select confirmation.*
  into confirmation_row
  from public.booking_confirmations as confirmation
  where confirmation.business_id = booking_row.business_id
    and confirmation.booking_id = booking_row.id
  order by confirmation.confirmed_at desc, confirmation.id desc
  limit 1;

  customer_email := private.normalize_customer_contact_email(
    confirmation_row.contact_email
  );
  if customer_email is null then
    raise exception 'booking_addon_contact_unavailable' using errcode = '23000';
  end if;

  select business.name
  into business_name
  from public.businesses as business
  where business.id = booking_row.business_id;

  snapshot := jsonb_build_object(
    'business_name', business_name,
    'booking_reference', booking_row.reference,
    'booking_title', booking_row.title,
    'inherited_scheduled_for', booking_row.scheduled_for,
    'title', addon_row.title,
    'description', addon_row.description,
    'currency', addon_row.currency,
    'total_amount_minor', addon_row.total_amount_minor,
    'deposit_amount_minor', addon_row.deposit_amount_minor,
    'balance_amount_minor', addon_row.total_amount_minor - addon_row.deposit_amount_minor
  );
  snapshot_hash := private.booking_terms_hash(snapshot);

  perform set_config('app.booking_addon_workflow_allowed', 'true', true);
  update public.booking_addons as addon
  set status = 'AWAITING_CUSTOMER',
      submitted_at = coalesce(addon.submitted_at, now()),
      terms_snapshot = snapshot,
      terms_hash = snapshot_hash,
      confirmation_contact_email = customer_email,
      confirmation_contact_phone = confirmation_row.contact_phone
  where addon.id = addon_row.id;

  replaced_count := private.revoke_open_booking_addon_links(addon_row.id, 'replaced');

  insert into public.booking_addon_confirmation_links (
    business_id, booking_id, booking_addon_id, token_hash, expires_at, created_by
  )
  values (
    addon_row.business_id, addon_row.booking_id, addon_row.id,
    p_token_hash, p_expires_at, caller_user_id
  )
  returning id into created_link_id;

  insert into public.email_events (
    business_id, booking_id, customer_id, booking_addon_id,
    booking_addon_confirmation_link_id, event_type, recipient_email
  )
  values (
    addon_row.business_id, addon_row.booking_id, booking_row.customer_id,
    addon_row.id, created_link_id, 'BOOKING_ADDON_REQUESTED', customer_email
  )
  returning id into created_email_event_id;

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    caller_user_id,
    addon_row.business_id,
    'BOOKING_ADDON_SUBMITTED',
    jsonb_build_object(
      'booking_id', addon_row.booking_id,
      'booking_addon_id', addon_row.id,
      'confirmation_link_id', created_link_id,
      'terms_hash', snapshot_hash,
      'replaced_link_count', replaced_count,
      'email_event_id', created_email_event_id
    )
  );

  return query
  select addon_row.id, created_link_id, p_expires_at, replaced_count, created_email_event_id;
end;
$$;

alter function public.submit_booking_addon(uuid, text, timestamptz) owner to postgres;
revoke all on function public.submit_booking_addon(uuid, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.submit_booking_addon(uuid, text, timestamptz)
to authenticated;

create or replace function private.enforce_new_delivery_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.feedback_links as feedback_link
    where feedback_link.business_id = new.business_id
      and feedback_link.booking_id = new.id
      and feedback_link.token_version = 1
      and feedback_link.purpose = 'booking_feedback'
      and feedback_link.used_at is null
      and feedback_link.revoked_at is null
      and feedback_link.expires_at > statement_timestamp()
  ) then
    raise exception 'delivery_transition_requires_feedback_capability'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

alter function private.enforce_new_delivery_transaction() owner to postgres;
revoke all on function private.enforce_new_delivery_transaction()
from public, anon, authenticated, service_role;

comment on function private.enforce_new_delivery_transaction()
is 'Strict boundary: every future READY to DELIVERED transition requires a same-tenant booking_feedback version-1 capability. A delivery email event is optional when the booking has no confirmed email; any event that exists remains association-locked by enforce_delivery_event_feedback_association.';

create or replace function public.deliver_booking_with_feedback(
  p_booking_id uuid
)
returns table (
  booking_id uuid,
  booking_status public.booking_status,
  email_event_id uuid,
  feedback_link_id uuid,
  feedback_token text,
  expires_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_event public.email_events;
  v_link public.feedback_links;
  v_created record;
  v_transition record;
  v_token text;
  v_expected_hash text;
  v_replaced_count integer;
begin
  if v_caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(v_booking.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;

  if v_booking.status in (
    'DELIVERED'::public.booking_status,
    'COMPLETED'::public.booking_status
  ) then
    select event.*
    into v_event
    from public.email_events as event
    where event.business_id = v_booking.business_id
      and event.booking_id = v_booking.id
      and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
      and event.feedback_link_id is not null
    order by event.created_at desc, event.id desc
    limit 1;

    if not found then
      raise exception 'delivery_feedback_association_unavailable'
        using errcode = '55000';
    end if;

    select feedback_link.*
    into v_link
    from public.feedback_links as feedback_link
    where feedback_link.id = v_event.feedback_link_id
      and feedback_link.business_id = v_event.business_id
      and feedback_link.booking_id = v_event.booking_id;

    if not found then
      raise exception 'delivery_feedback_association_unavailable'
        using errcode = '55000';
    end if;
    if v_link.token_version <> 1 then
      raise exception 'delivery_feedback_legacy_token_not_reconstructable'
        using errcode = '55000';
    end if;
    if v_link.revoked_at is not null then
      raise exception 'delivery_feedback_capability_revoked'
        using errcode = '55000';
    end if;
    if v_link.expires_at <= statement_timestamp() then
      raise exception 'delivery_feedback_capability_expired'
        using errcode = '55000';
    end if;

    v_token := private.derive_feedback_capability_token(
      v_link.token_version,
      v_link.business_id,
      v_link.booking_id,
      v_link.id,
      v_link.purpose
    );
    v_expected_hash := pg_catalog.encode(
      extensions.digest(v_token, 'sha256'),
      'hex'
    );
    if v_expected_hash is distinct from v_link.token_hash then
      raise exception 'delivery_feedback_capability_integrity_failure'
        using errcode = '23000';
    end if;

    return query
    select v_booking.id, v_booking.status, v_event.id, v_link.id,
      v_token, v_link.expires_at, true;
    return;
  end if;

  if v_booking.status <> 'READY'::public.booking_status then
    raise exception 'booking_not_ready_for_delivery' using errcode = '23000';
  end if;

  if exists (
    select 1
    from public.feedback as feedback
    where feedback.business_id = v_booking.business_id
      and feedback.booking_id = v_booking.id
  ) then
    raise exception 'feedback_already_submitted_before_delivery'
      using errcode = '23000';
  end if;

  v_replaced_count := private.revoke_open_feedback_links(
    v_booking.id,
    'delivery_v1_replaced'
  );

  select created.*
  into v_created
  from private.create_feedback_capability_v1(
    v_booking.business_id,
    v_booking.id,
    v_caller_user_id
  ) as created;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    v_caller_user_id,
    v_booking.business_id,
    case
      when v_replaced_count > 0
        then 'FEEDBACK_LINK_REGENERATED'::public.audit_event_type
      else 'FEEDBACK_LINK_CREATED'::public.audit_event_type
    end,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'feedback_link_id', v_created.feedback_link_id,
      'expires_at', v_created.expires_at,
      'token_version', 1,
      'replaced_link_count', v_replaced_count,
      'source', 'delivery'
    )
  );

  select transition.*
  into v_transition
  from public.transition_booking_status(
    v_booking.id,
    'DELIVERED'::public.booking_status,
    null
  ) as transition;

  if v_transition.email_event_id is not null then
    update public.email_events as event
    set feedback_link_id = v_created.feedback_link_id
    where event.id = v_transition.email_event_id
      and event.business_id = v_booking.business_id
      and event.booking_id = v_booking.id
      and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
      and event.feedback_link_id is null
    returning event.* into v_event;

    if not found then
      raise exception 'delivery_feedback_association_conflict'
        using errcode = '23000';
    end if;
  end if;

  return query
  select v_booking.id, 'DELIVERED'::public.booking_status, v_event.id,
    v_created.feedback_link_id, v_created.feedback_token,
    v_created.expires_at, false;
end;
$function$;

alter function public.deliver_booking_with_feedback(uuid) owner to postgres;
revoke all on function public.deliver_booking_with_feedback(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.deliver_booking_with_feedback(uuid)
to authenticated;

notify pgrst, 'reload schema';

commit;
