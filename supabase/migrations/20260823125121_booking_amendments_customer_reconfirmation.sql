create type public.booking_amendment_status as enum (
  'PENDING_CUSTOMER',
  'CONFIRMED',
  'REVOKED'
);

alter type public.audit_event_type add value if not exists 'BOOKING_AMENDMENT_SUBMITTED';
alter type public.audit_event_type add value if not exists 'BOOKING_AMENDMENT_REVOKED';
alter type public.audit_event_type add value if not exists 'BOOKING_AMENDMENT_CONFIRMED';
alter type public.audit_event_type add value if not exists 'BOOKING_AMENDMENT_SHARE_INITIATED';
alter type public.audit_event_type add value if not exists 'BOOKING_AMENDMENT_OPENED';

alter type public.email_event_type add value if not exists 'BOOKING_AMENDMENT_REQUESTED';
alter type public.email_event_type add value if not exists 'BOOKING_AMENDMENT_CONFIRMED';

create table public.booking_amendments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  status public.booking_amendment_status not null default 'PENDING_CUSTOMER',
  purpose text not null default 'booking_amendment_confirmation',
  token_hash text not null,
  expires_at timestamptz not null,
  reason text not null,
  base_terms_hash text not null,
  old_terms jsonb not null,
  proposed_terms jsonb not null,
  proposed_terms_hash text not null,
  changed_fields text[] not null,
  contact_email text not null,
  contact_phone text,
  proposed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  first_opened_at timestamptz,
  confirmed_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  effective_terms jsonb,
  effective_terms_hash text,
  constraint booking_amendments_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_amendments_token_hash_key unique (token_hash),
  constraint booking_amendments_token_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint booking_amendments_purpose_check
    check (purpose = 'booking_amendment_confirmation'),
  constraint booking_amendments_reason_length
    check (char_length(reason) between 1 and 500),
  constraint booking_amendments_reason_plain_text
    check (reason !~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'),
  constraint booking_amendments_hashes_format
    check (
      base_terms_hash ~ '^[a-f0-9]{64}$'
      and proposed_terms_hash ~ '^[a-f0-9]{64}$'
      and (effective_terms_hash is null or effective_terms_hash ~ '^[a-f0-9]{64}$')
    ),
  constraint booking_amendments_snapshots_are_objects
    check (
      jsonb_typeof(old_terms) = 'object'
      and jsonb_typeof(proposed_terms) = 'object'
      and (effective_terms is null or jsonb_typeof(effective_terms) = 'object')
    ),
  constraint booking_amendments_changed_fields_allowed
    check (
      cardinality(changed_fields) > 0
      and changed_fields <@ array[
        'title',
        'description',
        'currency',
        'total_amount_minor',
        'deposit_amount_minor',
        'scheduled_for'
      ]::text[]
    ),
  constraint booking_amendments_expiry_after_submission
    check (expires_at > submitted_at),
  constraint booking_amendments_contact_email_format
    check (
      contact_email = lower(trim(contact_email))
      and char_length(contact_email) <= 254
      and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  constraint booking_amendments_contact_phone_format
    check (
      contact_phone is null
      or (
        contact_phone = trim(contact_phone)
        and char_length(contact_phone) between 7 and 32
        and contact_phone ~ '^[0-9+().[:space:]-]+$'
      )
    ),
  constraint booking_amendments_status_timestamps
    check (
      (status = 'PENDING_CUSTOMER' and confirmed_at is null and revoked_at is null
        and effective_terms is null and effective_terms_hash is null)
      or (status = 'CONFIRMED' and confirmed_at is not null and revoked_at is null
        and effective_terms is not null and effective_terms_hash is not null)
      or (status = 'REVOKED' and confirmed_at is null and revoked_at is not null
        and effective_terms is null and effective_terms_hash is null)
    ),
  constraint booking_amendments_revoked_reason_consistency
    check (
      (status = 'REVOKED' and revoked_reason is not null and char_length(revoked_reason) <= 80)
      or (status <> 'REVOKED' and revoked_reason is null)
    )
);

create unique index booking_amendments_one_pending_per_booking_idx
on public.booking_amendments (booking_id)
where status = 'PENDING_CUSTOMER';

create index booking_amendments_business_booking_idx
on public.booking_amendments (business_id, booking_id, created_at desc);

create index booking_amendments_expiry_idx
on public.booking_amendments (expires_at)
where status = 'PENDING_CUSTOMER';

alter table public.booking_changes
  drop constraint booking_changes_type_check,
  drop constraint booking_changes_reschedule_changed,
  add column amendment_id uuid references public.booking_amendments(id) on delete restrict,
  add column old_terms jsonb,
  add column new_terms jsonb,
  add column changed_fields text[],
  add constraint booking_changes_type_check
    check (change_type in ('reschedule', 'amendment')),
  add constraint booking_changes_shape_check
    check (
      (
        change_type = 'reschedule'
        and previous_scheduled_for is distinct from new_scheduled_for
        and amendment_id is null
        and old_terms is null
        and new_terms is null
        and changed_fields is null
      )
      or (
        change_type = 'amendment'
        and amendment_id is not null
        and old_terms is not null
        and new_terms is not null
        and cardinality(changed_fields) > 0
      )
    );

create unique index booking_changes_amendment_key
on public.booking_changes (amendment_id)
where amendment_id is not null;

alter table public.email_events
  alter column booking_confirmation_id drop not null,
  add column booking_amendment_id uuid
    references public.booking_amendments(id) on delete cascade,
  add constraint email_events_subject_check
    check (num_nonnulls(booking_confirmation_id, booking_amendment_id) = 1),
  add constraint email_events_amendment_event_check
    check (
      (booking_amendment_id is null and event_type in ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED'))
      or (
        booking_confirmation_id is null
        and event_type in ('BOOKING_AMENDMENT_REQUESTED', 'BOOKING_AMENDMENT_CONFIRMED')
      )
    );

create unique index email_events_amendment_event_key
on public.email_events (booking_amendment_id, event_type)
where booking_amendment_id is not null;

create or replace function private.revoke_pending_booking_amendments(
  target_booking_id uuid,
  reason text,
  actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  amendment_row public.booking_amendments;
  revoked_count integer := 0;
begin
  for amendment_row in
    update public.booking_amendments as amendment
    set status = 'REVOKED',
        revoked_at = now(),
        revoked_reason = left(reason, 80)
    where amendment.booking_id = target_booking_id
      and amendment.status = 'PENDING_CUSTOMER'
    returning amendment.*
  loop
    revoked_count := revoked_count + 1;

    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      actor_user_id,
      amendment_row.business_id,
      'BOOKING_AMENDMENT_REVOKED',
      jsonb_build_object(
        'booking_id', amendment_row.booking_id,
        'amendment_id', amendment_row.id,
        'reason', left(reason, 80)
      )
    );
  end loop;

  return revoked_count;
end;
$$;

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
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'amendment_expiration_invalid'
      using errcode = '22023';
  end if;

  if clean_reason is null or char_length(clean_reason) > 500 then
    raise exception 'amendment_reason_required'
      using errcode = '22023';
  end if;

  if clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>' then
    raise exception 'amendment_reason_must_be_plain_text'
      using errcode = '22023';
  end if;

  if clean_title is null or char_length(clean_title) > 160 then
    raise exception 'amendment_title_invalid'
      using errcode = '22023';
  end if;

  if clean_description is not null and char_length(clean_description) > 5000 then
    raise exception 'amendment_description_too_long'
      using errcode = '22023';
  end if;

  if p_total_amount_minor < 0
    or p_deposit_amount_minor < 0
    or p_deposit_amount_minor > p_total_amount_minor
  then
    raise exception 'amendment_amounts_invalid'
      using errcode = '22023';
  end if;

  if p_scheduled_for is not null and p_scheduled_for <= now() then
    raise exception 'amendment_schedule_must_be_future'
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

  if booking_row.status not in ('CONFIRMED', 'IN_PROGRESS')
    or booking_row.confirmation_terms_hash is null
    or booking_row.confirmation_terms_snapshot is null
  then
    raise exception 'booking_not_eligible_for_amendment'
      using errcode = '23000';
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
    raise exception 'amendment_has_no_changes'
      using errcode = '22023';
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

  if confirmation_row.contact_email is null then
    select lower(trim(customer.email))
    into customer_email
    from public.customers as customer
    where customer.business_id = booking_row.business_id
      and customer.id = booking_row.customer_id;
  else
    customer_email := confirmation_row.contact_email;
  end if;

  if customer_email is null then
    raise exception 'amendment_contact_unavailable'
      using errcode = '23000';
  end if;

  replaced_count := private.revoke_pending_booking_amendments(
    booking_row.id,
    'replaced',
    caller_user_id
  );

  insert into public.booking_amendments (
    business_id,
    booking_id,
    token_hash,
    expires_at,
    reason,
    base_terms_hash,
    old_terms,
    proposed_terms,
    proposed_terms_hash,
    changed_fields,
    contact_email,
    contact_phone,
    proposed_by
  )
  values (
    booking_row.business_id,
    booking_row.id,
    p_token_hash,
    p_expires_at,
    clean_reason,
    booking_row.confirmation_terms_hash,
    old_snapshot,
    proposed_snapshot,
    proposed_hash,
    changed,
    customer_email,
    confirmation_row.contact_phone,
    caller_user_id
  )
  returning id into created_amendment_id;

  insert into public.email_events (
    business_id,
    booking_id,
    customer_id,
    booking_amendment_id,
    event_type,
    recipient_email
  )
  values (
    booking_row.business_id,
    booking_row.id,
    booking_row.customer_id,
    created_amendment_id,
    'BOOKING_AMENDMENT_REQUESTED',
    customer_email
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

create or replace function public.revoke_booking_amendment(p_amendment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  amendment_row public.booking_amendments;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select amendment.*
  into amendment_row
  from public.booking_amendments as amendment
  where amendment.id = p_amendment_id
  for update;

  if not found or not private.is_business_member(amendment_row.business_id) then
    raise exception 'amendment_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if amendment_row.status <> 'PENDING_CUSTOMER' then
    return false;
  end if;

  perform private.revoke_pending_booking_amendments(
    amendment_row.booking_id,
    'vendor_revoked',
    caller_user_id
  );

  return true;
end;
$$;

create or replace function private.booking_amendment_public_view(
  amendment_row public.booking_amendments
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  business_row public.businesses;
begin
  select business.*
  into business_row
  from public.businesses as business
  where business.id = amendment_row.business_id;

  if business_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'business_name', business_row.name,
    'business_logo_path', business_row.logo_path,
    'business_website', business_row.website,
    'business_instagram', business_row.instagram,
    'booking_reference', amendment_row.old_terms ->> 'booking_reference',
    'reason', amendment_row.reason,
    'current_terms', amendment_row.old_terms,
    'proposed_terms', amendment_row.proposed_terms,
    'changed_fields', to_jsonb(amendment_row.changed_fields),
    'expires_at', amendment_row.expires_at,
    'confirmed_at', amendment_row.confirmed_at
  );
end;
$$;

create or replace function public.get_booking_amendment_public_view(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  amendment_row public.booking_amendments;
  booking_row public.bookings;
  view_data jsonb;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select amendment.*
  into amendment_row
  from public.booking_amendments as amendment
  where amendment.token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if amendment_row.status = 'CONFIRMED' then
    view_data := private.booking_amendment_public_view(amendment_row);
    return jsonb_build_object('status', 'already_confirmed', 'amendment', view_data);
  end if;

  if amendment_row.status = 'REVOKED' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if amendment_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = amendment_row.booking_id
    and booking.business_id = amendment_row.business_id;

  if not found or booking_row.status not in ('CONFIRMED', 'IN_PROGRESS') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if booking_row.confirmation_terms_hash is distinct from amendment_row.base_terms_hash then
    return jsonb_build_object('status', 'stale');
  end if;

  view_data := private.booking_amendment_public_view(amendment_row);
  return jsonb_build_object('status', 'valid', 'amendment', view_data);
end;
$$;

create or replace function public.record_booking_amendment_open(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  amendment_row public.booking_amendments;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  update public.booking_amendments as amendment
  set first_opened_at = now()
  where amendment.token_hash = p_token_hash
    and amendment.status = 'PENDING_CUSTOMER'
    and amendment.expires_at > now()
    and amendment.first_opened_at is null
  returning amendment.* into amendment_row;

  if not found then
    return false;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    amendment_row.business_id,
    'BOOKING_AMENDMENT_OPENED',
    jsonb_build_object(
      'booking_id', amendment_row.booking_id,
      'amendment_id', amendment_row.id
    )
  );

  return true;
end;
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
  amendment_allowed boolean := false;
  revoked_count integer := 0;
  v_now timestamptz := now();
begin
  caller_user_id := auth.uid();
  transition_allowed := coalesce(current_setting('app.booking_transition_allowed', true), 'false') = 'true';
  reschedule_allowed := coalesce(current_setting('app.booking_reschedule_allowed', true), 'false') = 'true';
  amendment_allowed := coalesce(current_setting('app.booking_amendment_allowed', true), 'false') = 'true';

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

  if material_changed and old.status = 'CONFIRMED' and not amendment_allowed then
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

create or replace function public.confirm_booking_amendment_by_token_hash(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  amendment_row public.booking_amendments;
  booking_row public.bookings;
  confirmed_time timestamptz := now();
  created_email_event_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select amendment.*
  into amendment_row
  from public.booking_amendments as amendment
  where amendment.token_hash = p_token_hash
  for update;

  if not found or amendment_row.purpose <> 'booking_amendment_confirmation' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if amendment_row.status = 'CONFIRMED' then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'business_id', amendment_row.business_id,
      'booking_id', amendment_row.booking_id,
      'amendment_id', amendment_row.id
    );
  end if;

  if amendment_row.status = 'REVOKED' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if amendment_row.expires_at <= confirmed_time then
    return jsonb_build_object('status', 'expired');
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = amendment_row.booking_id
    and booking.business_id = amendment_row.business_id
  for update;

  if not found or booking_row.status not in ('CONFIRMED', 'IN_PROGRESS') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if booking_row.confirmation_terms_hash is distinct from amendment_row.base_terms_hash then
    return jsonb_build_object('status', 'stale');
  end if;

  perform set_config('app.booking_amendment_allowed', 'true', true);

  update public.bookings as booking
  set title = amendment_row.proposed_terms ->> 'title',
      description = amendment_row.proposed_terms ->> 'description',
      currency = (amendment_row.proposed_terms ->> 'currency')::public.booking_currency,
      total_amount_minor = (amendment_row.proposed_terms ->> 'total_amount_minor')::bigint,
      deposit_amount_minor = (amendment_row.proposed_terms ->> 'deposit_amount_minor')::bigint,
      scheduled_for = (amendment_row.proposed_terms ->> 'scheduled_for')::timestamptz,
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = amendment_row.proposed_terms_hash,
      confirmation_terms_snapshot = amendment_row.proposed_terms
  where booking.id = booking_row.id;

  update public.booking_amendments as amendment
  set status = 'CONFIRMED',
      confirmed_at = confirmed_time,
      effective_terms = amendment_row.proposed_terms,
      effective_terms_hash = amendment_row.proposed_terms_hash
  where amendment.id = amendment_row.id;

  insert into public.booking_changes (
    business_id,
    booking_id,
    changed_by,
    change_type,
    amendment_id,
    previous_scheduled_for,
    new_scheduled_for,
    old_terms,
    new_terms,
    changed_fields
  )
  values (
    amendment_row.business_id,
    amendment_row.booking_id,
    null,
    'amendment',
    amendment_row.id,
    (amendment_row.old_terms ->> 'scheduled_for')::timestamptz,
    (amendment_row.proposed_terms ->> 'scheduled_for')::timestamptz,
    amendment_row.old_terms,
    amendment_row.proposed_terms,
    amendment_row.changed_fields
  );

  insert into public.email_events (
    business_id,
    booking_id,
    customer_id,
    booking_amendment_id,
    event_type,
    recipient_email
  )
  values (
    amendment_row.business_id,
    amendment_row.booking_id,
    booking_row.customer_id,
    amendment_row.id,
    'BOOKING_AMENDMENT_CONFIRMED',
    amendment_row.contact_email
  )
  on conflict (booking_amendment_id, event_type) do nothing
  returning id into created_email_event_id;

  if created_email_event_id is null then
    select event.id
    into created_email_event_id
    from public.email_events as event
    where event.booking_amendment_id = amendment_row.id
      and event.event_type = 'BOOKING_AMENDMENT_CONFIRMED';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    amendment_row.business_id,
    'BOOKING_AMENDMENT_CONFIRMED',
    jsonb_build_object(
      'booking_id', amendment_row.booking_id,
      'amendment_id', amendment_row.id,
      'base_terms_hash', amendment_row.base_terms_hash,
      'effective_terms_hash', amendment_row.proposed_terms_hash,
      'changed_fields', to_jsonb(amendment_row.changed_fields),
      'email_event_id', created_email_event_id
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', amendment_row.business_id,
    'booking_id', amendment_row.booking_id,
    'amendment_id', amendment_row.id,
    'confirmed_at', confirmed_time,
    'effective_terms_hash', amendment_row.proposed_terms_hash,
    'email_event_id', created_email_event_id
  );
end;
$$;

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
  cancellation_recipient text;
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

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_scheduled_for timestamptz
)
returns table (
  booking_id uuid,
  previous_scheduled_for timestamptz,
  new_scheduled_for timestamptz,
  status public.booking_status
)
language plpgsql
security definer
set search_path = ''
as $$
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

  if booking_row.status not in ('DRAFT', 'AWAITING_CUSTOMER', 'CONFIRMED') then
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
      'confirmation_invalidated', booking_row.status = 'CONFIRMED'
    )
  );

  return query
  select updated_row.id, booking_row.scheduled_for, updated_row.scheduled_for, updated_row.status;
end;
$$;

alter table public.booking_amendments enable row level security;

revoke all on public.booking_amendments from anon, authenticated;
grant select on public.booking_amendments to authenticated;
grant select, insert, update, delete on public.booking_amendments to service_role;

create policy "Members can read booking amendments"
on public.booking_amendments
for select
to authenticated
using (private.is_business_member(business_id));

revoke all on function private.revoke_pending_booking_amendments(uuid, text, uuid)
from public, anon, authenticated;
revoke all on function private.booking_amendment_public_view(public.booking_amendments)
from public, anon, authenticated;
revoke all on function private.enforce_booking_integrity()
from public, anon, authenticated;

revoke all on function public.create_booking_amendment(
  uuid, text, text, text, public.booking_currency, bigint, bigint, timestamptz, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.revoke_booking_amendment(uuid)
from public, anon, authenticated;
revoke all on function public.get_booking_amendment_public_view(text)
from public, anon, authenticated;
revoke all on function public.record_booking_amendment_open(text)
from public, anon, authenticated;
revoke all on function public.confirm_booking_amendment_by_token_hash(text)
from public, anon, authenticated;
revoke all on function public.transition_booking_status(uuid, public.booking_status, text)
from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, timestamptz)
from public, anon, authenticated;

grant execute on function public.create_booking_amendment(
  uuid, text, text, text, public.booking_currency, bigint, bigint, timestamptz, text, timestamptz
) to authenticated, service_role;
grant execute on function public.revoke_booking_amendment(uuid)
to authenticated, service_role;
grant execute on function public.get_booking_amendment_public_view(text)
to service_role;
grant execute on function public.record_booking_amendment_open(text)
to service_role;
grant execute on function public.confirm_booking_amendment_by_token_hash(text)
to service_role;
grant execute on function public.transition_booking_status(uuid, public.booking_status, text)
to authenticated, service_role;
grant execute on function public.reschedule_booking(uuid, timestamptz)
to authenticated, service_role;

notify pgrst, 'reload schema';
