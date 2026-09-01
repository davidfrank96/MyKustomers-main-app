create or replace function private.normalize_customer_contact_email(input_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when input_email is null then null
    when position('@' in trim(input_email)) <= 1 then trim(input_email)
    else left(trim(input_email), length(trim(input_email)) - length(split_part(trim(input_email), '@', 2)))
      || lower(split_part(trim(input_email), '@', 2))
  end;
$$;

revoke all on function private.normalize_customer_contact_email(text)
from public, anon, authenticated;

alter table public.booking_confirmations
  drop constraint booking_confirmations_contact_email_format,
  add constraint booking_confirmations_contact_email_format
    check (
      contact_email is null
      or (
        contact_email = trim(contact_email)
        and char_length(contact_email) <= 254
        and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      )
    );

alter table public.booking_amendments
  drop constraint booking_amendments_contact_email_format,
  add constraint booking_amendments_contact_email_format
    check (
      contact_email = trim(contact_email)
      and char_length(contact_email) <= 254
      and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    );

alter table public.booking_addons
  drop constraint booking_addons_contact_email_format,
  add constraint booking_addons_contact_email_format
    check (
      confirmation_contact_email is null
      or (
        confirmation_contact_email = trim(confirmation_contact_email)
        and char_length(confirmation_contact_email) <= 254
        and confirmation_contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      )
    );

alter table public.email_events
  drop constraint email_events_recipient_email_format,
  drop constraint email_events_subject_check,
  add constraint email_events_recipient_email_format check (
    recipient_email = trim(recipient_email)
    and char_length(recipient_email) <= 254
    and recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
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
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is not null
        and event_type = 'BOOKING_CONFIRMATION_REQUESTED'
      )
    );

create unique index email_events_confirmation_request_link_unique
on public.email_events (confirmation_link_id)
where event_type = 'BOOKING_CONFIRMATION_REQUESTED';

create or replace function public.create_booking_confirmation_request(
  p_booking_id uuid,
  p_contact_email text,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '24 hours'
)
returns table (
  confirmation_link_id uuid,
  email_event_id uuid,
  recipient_email text,
  expires_at timestamptz,
  replaced_link_count integer,
  request_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  latest_request public.email_events;
  normalized_contact_email text := private.normalize_customer_contact_email(p_contact_email);
  revoked_count integer;
  inserted_link_id uuid;
  inserted_event_id uuid;
  existing_link_expires_at timestamptz;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if normalized_contact_email is null
    or char_length(normalized_contact_email) > 254
    or normalized_contact_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'invalid_contact_email'
      using errcode = '22023';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'confirmation_link_expiration_invalid'
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

  if booking_row.status not in ('DRAFT', 'AWAITING_CUSTOMER') then
    raise exception 'booking_not_eligible_for_confirmation_request'
      using errcode = '23000';
  end if;

  select event.*
  into latest_request
  from public.email_events as event
  where event.business_id = booking_row.business_id
    and event.booking_id = booking_row.id
    and event.event_type = 'BOOKING_CONFIRMATION_REQUESTED'
  order by event.created_at desc, event.id desc
  limit 1;

  if latest_request.id is not null
    and latest_request.recipient_email = normalized_contact_email
    and latest_request.status in ('PENDING', 'SENDING', 'SENT')
    and latest_request.created_at > now() - interval '30 seconds'
  then
    select link.expires_at
    into existing_link_expires_at
    from public.confirmation_links as link
    where link.id = latest_request.confirmation_link_id;

    return query
      select
        latest_request.confirmation_link_id,
        latest_request.id,
        latest_request.recipient_email,
        existing_link_expires_at,
        0,
        'duplicate_ignored'::text;
    return;
  end if;

  revoked_count := private.revoke_open_confirmation_links(
    booking_row.id,
    'confirmation_request_replaced'
  );

  if booking_row.status = 'DRAFT' then
    perform set_config('app.booking_transition_allowed', 'true', true);
    update public.bookings
    set status = 'AWAITING_CUSTOMER'
    where id = booking_row.id;
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
  returning id into inserted_link_id;

  insert into public.email_events (
    business_id,
    booking_id,
    customer_id,
    booking_confirmation_id,
    confirmation_link_id,
    event_type,
    recipient_email
  )
  values (
    booking_row.business_id,
    booking_row.id,
    booking_row.customer_id,
    null,
    inserted_link_id,
    'BOOKING_CONFIRMATION_REQUESTED',
    normalized_contact_email
  )
  returning id into inserted_event_id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    case
      when revoked_count > 0 then 'CONFIRMATION_LINK_REGENERATED'::public.audit_event_type
      else 'CONFIRMATION_LINK_CREATED'::public.audit_event_type
    end,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_link_id', inserted_link_id,
      'expires_at', p_expires_at,
      'replaced_link_count', revoked_count,
      'source', 'confirmation_email_request',
      'email_event_id', inserted_event_id
    )
  );

  return query
    select
      inserted_link_id,
      inserted_event_id,
      normalized_contact_email,
      p_expires_at,
      revoked_count,
      'created'::text;
end;
$$;

revoke all on function public.create_booking_confirmation_request(uuid, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.create_booking_confirmation_request(uuid, text, text, timestamptz)
to authenticated;

create or replace function public.create_booking_with_customer(
  p_business_id uuid,
  p_customer_mode text,
  p_customer_id uuid,
  p_new_customer_name text,
  p_new_customer_email text,
  p_new_customer_phone text,
  p_title text,
  p_description text,
  p_currency public.booking_currency,
  p_total_amount_minor bigint,
  p_deposit_amount_minor bigint,
  p_scheduled_for timestamptz,
  p_internal_notes text
)
returns table (
  booking_id uuid,
  customer_id uuid,
  customer_created boolean,
  reference text,
  status public.booking_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  current_business_id uuid;
  selected_customer_id uuid;
  created_booking_id uuid;
  created_booking_reference text;
  created_booking_status public.booking_status;
  normalized_customer_name text := nullif(trim(p_new_customer_name), '');
  normalized_customer_email text := nullif(
    private.normalize_customer_contact_email(p_new_customer_email),
    ''
  );
  normalized_customer_phone text := nullif(trim(p_new_customer_phone), '');
  possible_duplicate boolean := false;
  did_create_customer boolean := false;
begin
  if actor_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.business_id
  into current_business_id
  from public.business_members as membership
  where membership.user_id = actor_user_id
    and membership.business_id = p_business_id
    and membership.status = 'active'
  limit 1;

  if current_business_id is null then
    raise exception 'active_business_membership_required' using errcode = '42501';
  end if;

  if normalized_customer_email is not null
    and (
      char_length(normalized_customer_email) > 254
      or normalized_customer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  then
    raise exception 'invalid_customer_email' using errcode = '22023';
  end if;

  if p_customer_mode = 'existing' then
    if p_customer_id is null
      or normalized_customer_name is not null
      or normalized_customer_email is not null
      or normalized_customer_phone is not null
    then
      raise exception 'invalid_existing_customer_payload' using errcode = '22023';
    end if;

    select customer.id
    into selected_customer_id
    from public.customers as customer
    where customer.id = p_customer_id
      and customer.business_id = current_business_id
      and customer.archived_at is null
    for key share;

    if selected_customer_id is null then
      raise exception 'customer_not_available' using errcode = '42501';
    end if;
  elsif p_customer_mode = 'new' then
    if p_customer_id is not null or normalized_customer_name is null then
      raise exception 'invalid_new_customer_payload' using errcode = '22023';
    end if;

    select exists (
      select 1
      from public.customers as customer
      where customer.business_id = current_business_id
        and customer.archived_at is null
        and (
          lower(trim(customer.name)) = lower(normalized_customer_name)
          or (
            normalized_customer_email is not null
            and private.normalize_customer_contact_email(customer.email)
              = normalized_customer_email
          )
          or (
            normalized_customer_phone is not null
            and trim(customer.phone) = normalized_customer_phone
          )
        )
    ) into possible_duplicate;

    insert into public.customers (business_id, name, email, phone)
    values (
      current_business_id,
      normalized_customer_name,
      normalized_customer_email,
      normalized_customer_phone
    )
    returning id into selected_customer_id;

    did_create_customer := true;

    insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
    values (
      actor_user_id,
      current_business_id,
      'CUSTOMER_CREATED',
      jsonb_build_object(
        'customer_id', selected_customer_id,
        'possible_duplicate', possible_duplicate,
        'source', 'inline_booking'
      )
    );
  else
    raise exception 'invalid_customer_mode' using errcode = '22023';
  end if;

  insert into public.bookings (
    business_id,
    customer_id,
    title,
    description,
    currency,
    total_amount_minor,
    deposit_amount_minor,
    scheduled_for,
    internal_notes,
    created_by
  )
  values (
    current_business_id,
    selected_customer_id,
    trim(p_title),
    nullif(trim(p_description), ''),
    p_currency,
    p_total_amount_minor,
    p_deposit_amount_minor,
    p_scheduled_for,
    nullif(trim(p_internal_notes), ''),
    actor_user_id
  )
  returning id, bookings.reference, bookings.status
  into created_booking_id, created_booking_reference, created_booking_status;

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    actor_user_id,
    current_business_id,
    'BOOKING_CREATED',
    jsonb_build_object('booking_id', created_booking_id)
  );

  return query
  select
    created_booking_id,
    selected_customer_id,
    did_create_customer,
    created_booking_reference,
    created_booking_status;
end;
$$;

alter function public.create_booking_with_customer(
  uuid, text, uuid, text, text, text, text, text,
  public.booking_currency, bigint, bigint, timestamptz, text
) owner to postgres;
revoke all on function public.create_booking_with_customer(
  uuid, text, uuid, text, text, text, text, text,
  public.booking_currency, bigint, bigint, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.create_booking_with_customer(
  uuid, text, uuid, text, text, text, text, text,
  public.booking_currency, bigint, bigint, timestamptz, text
) to authenticated;

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
    select private.normalize_customer_contact_email(customer.email)
    into customer_email
    from public.customers as customer
    where customer.business_id = booking_row.business_id
      and customer.id = booking_row.customer_id;
  end if;
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
    select private.normalize_customer_contact_email(customer.email)
    into customer_email
    from public.customers as customer
    where customer.business_id = booking_row.business_id
      and customer.id = booking_row.customer_id;
  end if;
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
    if notification_recipient is null then
      select private.normalize_customer_contact_email(customer.email)
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
    if notification_recipient is null then
      select private.normalize_customer_contact_email(customer.email)
      into notification_recipient
      from public.customers as customer
      where customer.business_id = booking_row.business_id
        and customer.id = booking_row.customer_id;
    end if;

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
    'BOOKING_CONFIRMATION_REQUESTED',
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
      and (v_event_type = 'ALL' or email_event.event_type::text = v_event_type)
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
        where status in ('PENDING'::public.email_event_status, 'SENDING'::public.email_event_status)
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
          count(*) filter (where base_filtered.status = 'FAILED'::public.email_event_status) as failed
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
revoke all on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) from public, anon, authenticated;
grant execute on function public.get_platform_admin_email_operations(
  text, text, text, text, uuid, uuid, integer, integer
) to authenticated;

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

  update public.customers as customer
  set email = case
        when nullif(trim(customer_row.email), '') is null then normalized_contact_email
        else customer_row.email
      end,
      phone = case
        when normalized_contact_phone is not null
          and nullif(trim(customer_row.phone), '') is null
          then normalized_contact_phone
        else customer_row.phone
      end
  where customer.id = customer_row.id
    and (
      nullif(trim(customer_row.email), '') is null
      or (
        normalized_contact_phone is not null
        and nullif(trim(customer_row.phone), '') is null
      )
    );

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

notify pgrst, 'reload schema';
