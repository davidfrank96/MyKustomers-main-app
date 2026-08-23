create type public.booking_addon_status as enum (
  'DRAFT',
  'AWAITING_CUSTOMER',
  'CONFIRMED',
  'CANCELLED'
);

alter type public.audit_event_type add value if not exists 'BOOKING_ADDON_CREATED';
alter type public.audit_event_type add value if not exists 'BOOKING_ADDON_SUBMITTED';
alter type public.audit_event_type add value if not exists 'BOOKING_ADDON_SHARE_INITIATED';
alter type public.audit_event_type add value if not exists 'BOOKING_ADDON_OPENED';
alter type public.audit_event_type add value if not exists 'BOOKING_ADDON_CONFIRMED';
alter type public.audit_event_type add value if not exists 'BOOKING_ADDON_CANCELLED';

alter type public.email_event_type add value if not exists 'BOOKING_ADDON_REQUESTED';
alter type public.email_event_type add value if not exists 'BOOKING_ADDON_CONFIRMED';

create table public.booking_addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text,
  currency public.booking_currency not null,
  total_amount_minor bigint not null,
  deposit_amount_minor bigint not null default 0,
  status public.booking_addon_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  terms_snapshot jsonb,
  terms_hash text,
  confirmation_contact_email text,
  confirmation_contact_phone text,
  constraint booking_addons_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_addons_business_booking_id_key
    unique (business_id, booking_id, id),
  constraint booking_addons_title_length
    check (char_length(title) between 1 and 160),
  constraint booking_addons_description_length
    check (description is null or char_length(description) <= 5000),
  constraint booking_addons_total_nonnegative
    check (total_amount_minor >= 0 and total_amount_minor <= 9007199254740991),
  constraint booking_addons_deposit_nonnegative
    check (deposit_amount_minor >= 0 and deposit_amount_minor <= 9007199254740991),
  constraint booking_addons_deposit_not_greater_than_total
    check (deposit_amount_minor <= total_amount_minor),
  constraint booking_addons_terms_snapshot_object
    check (terms_snapshot is null or jsonb_typeof(terms_snapshot) = 'object'),
  constraint booking_addons_terms_hash_format
    check (terms_hash is null or terms_hash ~ '^[a-f0-9]{64}$'),
  constraint booking_addons_contact_email_format
    check (
      confirmation_contact_email is null
      or (
        confirmation_contact_email = lower(trim(confirmation_contact_email))
        and char_length(confirmation_contact_email) <= 254
        and confirmation_contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      )
    ),
  constraint booking_addons_contact_phone_format
    check (
      confirmation_contact_phone is null
      or (
        confirmation_contact_phone = trim(confirmation_contact_phone)
        and char_length(confirmation_contact_phone) between 7 and 32
        and confirmation_contact_phone ~ '^[0-9+().[:space:]-]+$'
      )
    ),
  constraint booking_addons_cancellation_reason
    check (
      (status = 'CANCELLED'
        and cancellation_reason is not null
        and char_length(cancellation_reason) <= 80)
      or (status <> 'CANCELLED' and cancellation_reason is null)
    ),
  constraint booking_addons_status_shape
    check (
      (
        status = 'DRAFT'
        and submitted_at is null
        and confirmed_at is null
        and cancelled_at is null
        and terms_snapshot is null
        and terms_hash is null
        and confirmation_contact_email is null
        and confirmation_contact_phone is null
      )
      or (
        status = 'AWAITING_CUSTOMER'
        and submitted_at is not null
        and confirmed_at is null
        and cancelled_at is null
        and terms_snapshot is not null
        and terms_hash is not null
        and confirmation_contact_email is not null
      )
      or (
        status = 'CONFIRMED'
        and submitted_at is not null
        and confirmed_at is not null
        and cancelled_at is null
        and terms_snapshot is not null
        and terms_hash is not null
        and confirmation_contact_email is not null
      )
      or (
        status = 'CANCELLED'
        and confirmed_at is null
        and cancelled_at is not null
        and (
          (
            submitted_at is null
            and terms_snapshot is null
            and terms_hash is null
            and confirmation_contact_email is null
            and confirmation_contact_phone is null
          )
          or (
            submitted_at is not null
            and terms_snapshot is not null
            and terms_hash is not null
            and confirmation_contact_email is not null
          )
        )
      )
    )
);

create table public.booking_addon_confirmation_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  booking_id uuid not null,
  booking_addon_id uuid not null,
  token_hash text not null unique,
  purpose text not null default 'booking_addon_confirmation',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  first_opened_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint booking_addon_links_addon_business_fk
    foreign key (business_id, booking_id, booking_addon_id)
    references public.booking_addons (business_id, booking_id, id)
    on delete cascade,
  constraint booking_addon_links_token_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint booking_addon_links_purpose
    check (purpose = 'booking_addon_confirmation'),
  constraint booking_addon_links_expiry
    check (expires_at > created_at and expires_at <= created_at + interval '48 hours'),
  constraint booking_addon_links_consumption
    check (num_nonnulls(used_at, revoked_at) <= 1),
  constraint booking_addon_links_revoked_reason
    check (
      (revoked_at is not null and revoked_reason is not null and char_length(revoked_reason) <= 80)
      or (revoked_at is null and revoked_reason is null)
    )
);

create index booking_addons_business_booking_idx
on public.booking_addons (business_id, booking_id, created_at);

create index booking_addons_business_status_idx
on public.booking_addons (business_id, status, confirmed_at);

create unique index booking_addons_one_awaiting_per_booking_idx
on public.booking_addons (booking_id)
where status = 'AWAITING_CUSTOMER';

create index booking_addon_links_addon_created_idx
on public.booking_addon_confirmation_links (business_id, booking_addon_id, created_at desc);

create unique index booking_addon_links_one_open_idx
on public.booking_addon_confirmation_links (booking_addon_id)
where used_at is null and revoked_at is null;

alter table public.email_events
  drop constraint email_events_subject_check,
  drop constraint email_events_amendment_event_check,
  add column booking_addon_id uuid
    references public.booking_addons(id) on delete cascade,
  add column booking_addon_confirmation_link_id uuid
    references public.booking_addon_confirmation_links(id) on delete cascade,
  add constraint email_events_subject_check
    check (
      (
        booking_confirmation_id is not null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and event_type in ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED')
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is not null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and event_type in ('BOOKING_AMENDMENT_REQUESTED', 'BOOKING_AMENDMENT_CONFIRMED')
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is not null
        and event_type = 'BOOKING_ADDON_REQUESTED'
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is null
        and event_type = 'BOOKING_ADDON_CONFIRMED'
      )
    ),
  add constraint email_events_addon_request_unique
    unique (booking_addon_confirmation_link_id, event_type),
  add constraint email_events_addon_confirm_unique
    unique (booking_addon_id, event_type);

create or replace function private.enforce_booking_addon_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_allowed boolean := coalesce(
    current_setting('app.booking_addon_workflow_allowed', true),
    'false'
  ) = 'true';
begin
  if old.business_id is distinct from new.business_id
    or old.booking_id is distinct from new.booking_id
    or old.created_by is distinct from new.created_by
    or old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.currency is distinct from new.currency
    or old.total_amount_minor is distinct from new.total_amount_minor
    or old.deposit_amount_minor is distinct from new.deposit_amount_minor
    or old.created_at is distinct from new.created_at
  then
    raise exception 'booking_addon_terms_immutable'
      using errcode = '23000';
  end if;

  if not workflow_allowed and (
    old.status is distinct from new.status
    or old.submitted_at is distinct from new.submitted_at
    or old.confirmed_at is distinct from new.confirmed_at
    or old.cancelled_at is distinct from new.cancelled_at
    or old.cancellation_reason is distinct from new.cancellation_reason
    or old.terms_snapshot is distinct from new.terms_snapshot
    or old.terms_hash is distinct from new.terms_hash
    or old.confirmation_contact_email is distinct from new.confirmation_contact_email
    or old.confirmation_contact_phone is distinct from new.confirmation_contact_phone
  ) then
    raise exception 'booking_addon_workflow_required'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

create trigger booking_addons_enforce_integrity
before update on public.booking_addons
for each row execute function private.enforce_booking_addon_integrity();

create or replace function private.revoke_open_booking_addon_links(
  target_addon_id uuid,
  revoke_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_count integer;
begin
  update public.booking_addon_confirmation_links as link
  set revoked_at = now(),
      revoked_reason = left(revoke_reason, 80)
  where link.booking_addon_id = target_addon_id
    and link.used_at is null
    and link.revoked_at is null;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

create or replace function private.cancel_pending_booking_addons(
  target_booking_id uuid,
  cancel_reason text,
  actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  addon_row public.booking_addons;
  cancelled_count integer := 0;
  v_reason text := left(cancel_reason, 80);
  v_actor_user_id uuid := actor_user_id;
begin
  perform set_config('app.booking_addon_workflow_allowed', 'true', true);

  for addon_row in
    update public.booking_addons as addon
    set status = 'CANCELLED',
        cancelled_at = now(),
        cancellation_reason = v_reason
    where addon.booking_id = target_booking_id
      and addon.status in ('DRAFT', 'AWAITING_CUSTOMER')
    returning addon.*
  loop
    cancelled_count := cancelled_count + 1;
    perform private.revoke_open_booking_addon_links(addon_row.id, v_reason);

    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      v_actor_user_id,
      addon_row.business_id,
      'BOOKING_ADDON_CANCELLED',
      jsonb_build_object(
        'booking_id', addon_row.booking_id,
        'booking_addon_id', addon_row.id,
        'reason', v_reason
      )
    );
  end loop;

  return cancelled_count;
end;
$$;

create or replace function private.handle_booking_addon_parent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.scheduled_for is distinct from new.scheduled_for then
    perform private.cancel_pending_booking_addons(new.id, 'booking_rescheduled', auth.uid());
  elsif old.status is distinct from new.status and new.status in ('READY', 'CANCELLED') then
    perform private.cancel_pending_booking_addons(
      new.id,
      case when new.status = 'CANCELLED' then 'booking_cancelled' else 'booking_advanced' end,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

create trigger bookings_handle_pending_addons
after update of status, scheduled_for on public.bookings
for each row execute function private.handle_booking_addon_parent_change();

create or replace function private.prevent_amendment_with_pending_addon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.booking_addons as addon
    where addon.booking_id = new.booking_id
      and addon.status = 'AWAITING_CUSTOMER'
  ) then
    raise exception 'booking_has_pending_addon_request'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

create trigger booking_amendments_prevent_pending_addon_conflict
before insert on public.booking_amendments
for each row execute function private.prevent_amendment_with_pending_addon();

create or replace function public.create_booking_addon(
  p_booking_id uuid,
  p_title text,
  p_description text,
  p_total_amount_minor bigint,
  p_deposit_amount_minor bigint
)
returns table (
  booking_addon_id uuid,
  currency public.booking_currency
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
  clean_description text := nullif(trim(coalesce(p_description, '')), '');
  created_addon_id uuid;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if clean_title is null or char_length(clean_title) > 160 then
    raise exception 'booking_addon_title_invalid' using errcode = '22023';
  end if;

  if clean_description is not null and char_length(clean_description) > 5000 then
    raise exception 'booking_addon_description_too_long' using errcode = '22023';
  end if;

  if p_total_amount_minor < 0
    or p_deposit_amount_minor < 0
    or p_deposit_amount_minor > p_total_amount_minor
    or p_total_amount_minor > 9007199254740991
    or p_deposit_amount_minor > 9007199254740991
  then
    raise exception 'booking_addon_amounts_invalid' using errcode = '22023';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;

  if booking_row.status not in ('CONFIRMED', 'IN_PROGRESS') then
    raise exception 'booking_not_eligible_for_addon' using errcode = '23000';
  end if;

  insert into public.booking_addons (
    business_id,
    booking_id,
    created_by,
    title,
    description,
    currency,
    total_amount_minor,
    deposit_amount_minor
  )
  values (
    booking_row.business_id,
    booking_row.id,
    caller_user_id,
    clean_title,
    clean_description,
    booking_row.currency,
    p_total_amount_minor,
    p_deposit_amount_minor
  )
  returning id into created_addon_id;

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    caller_user_id,
    booking_row.business_id,
    'BOOKING_ADDON_CREATED',
    jsonb_build_object('booking_id', booking_row.id, 'booking_addon_id', created_addon_id)
  );

  return query select created_addon_id, booking_row.currency;
end;
$$;

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
    select 1
    from public.booking_amendments as amendment
    where amendment.booking_id = booking_row.id
      and amendment.status = 'PENDING_CUSTOMER'
  ) then
    raise exception 'booking_has_pending_amendment_request' using errcode = '23000';
  end if;

  if exists (
    select 1
    from public.booking_addons as other_addon
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

  customer_email := confirmation_row.contact_email;
  if customer_email is null then
    select lower(trim(customer.email))
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
    business_id,
    booking_id,
    booking_addon_id,
    token_hash,
    expires_at,
    created_by
  )
  values (
    addon_row.business_id,
    addon_row.booking_id,
    addon_row.id,
    p_token_hash,
    p_expires_at,
    caller_user_id
  )
  returning id into created_link_id;

  insert into public.email_events (
    business_id,
    booking_id,
    customer_id,
    booking_addon_id,
    booking_addon_confirmation_link_id,
    event_type,
    recipient_email
  )
  values (
    addon_row.business_id,
    addon_row.booking_id,
    booking_row.customer_id,
    addon_row.id,
    created_link_id,
    'BOOKING_ADDON_REQUESTED',
    customer_email
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

create or replace function public.cancel_booking_addon(p_booking_addon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  addon_row public.booking_addons;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select addon.*
  into addon_row
  from public.booking_addons as addon
  where addon.id = p_booking_addon_id
  for update;

  if not found or not private.is_business_member(addon_row.business_id) then
    raise exception 'booking_addon_not_found_or_unauthorized' using errcode = '42501';
  end if;

  if addon_row.status = 'CANCELLED' then
    return false;
  end if;

  if addon_row.status not in ('DRAFT', 'AWAITING_CUSTOMER') then
    raise exception 'confirmed_booking_addon_is_immutable' using errcode = '23000';
  end if;

  perform set_config('app.booking_addon_workflow_allowed', 'true', true);
  update public.booking_addons as addon
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancellation_reason = 'vendor_cancelled'
  where addon.id = addon_row.id;

  perform private.revoke_open_booking_addon_links(addon_row.id, 'vendor_cancelled');

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    caller_user_id,
    addon_row.business_id,
    'BOOKING_ADDON_CANCELLED',
    jsonb_build_object(
      'booking_id', addon_row.booking_id,
      'booking_addon_id', addon_row.id,
      'reason', 'vendor_cancelled'
    )
  );

  return true;
end;
$$;

create or replace function private.booking_addon_public_view(
  link_row public.booking_addon_confirmation_links
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  addon_row public.booking_addons;
  booking_row public.bookings;
  business_row public.businesses;
  public_status text;
begin
  select addon.* into addon_row
  from public.booking_addons as addon
  where addon.id = link_row.booking_addon_id
    and addon.business_id = link_row.business_id
    and addon.booking_id = link_row.booking_id;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.* into booking_row
  from public.bookings as booking
  where booking.id = addon_row.booking_id
    and booking.business_id = addon_row.business_id;

  select business.* into business_row
  from public.businesses as business
  where business.id = addon_row.business_id;

  public_status := case
    when link_row.revoked_at is not null or addon_row.status = 'CANCELLED' then 'revoked'
    when addon_row.status = 'CONFIRMED' and link_row.used_at is not null then 'confirmed'
    when link_row.expires_at <= now() then 'expired'
    when addon_row.status = 'AWAITING_CUSTOMER' and link_row.used_at is null then 'valid'
    else 'unavailable'
  end;

  if public_status = 'unavailable' then
    return jsonb_build_object('status', public_status);
  end if;

  return jsonb_build_object(
    'status', public_status,
    'addon', jsonb_build_object(
      'business_name', business_row.name,
      'business_logo_path', business_row.logo_path,
      'business_website', business_row.website,
      'business_instagram', business_row.instagram,
      'booking_reference', booking_row.reference,
      'booking_title', booking_row.title,
      'scheduled_for', booking_row.scheduled_for,
      'title', addon_row.title,
      'description', addon_row.description,
      'currency', addon_row.currency,
      'total_amount_minor', addon_row.total_amount_minor,
      'deposit_amount_minor', addon_row.deposit_amount_minor,
      'balance_amount_minor', addon_row.total_amount_minor - addon_row.deposit_amount_minor,
      'expires_at', link_row.expires_at,
      'confirmed_at', addon_row.confirmed_at
    )
  );
end;
$$;

create or replace function public.get_booking_addon_public_view(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.booking_addon_confirmation_links;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select link.* into link_row
  from public.booking_addon_confirmation_links as link
  where link.token_hash = p_token_hash;

  if not found or link_row.purpose <> 'booking_addon_confirmation' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return private.booking_addon_public_view(link_row);
end;
$$;

create or replace function public.record_booking_addon_open(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.booking_addon_confirmation_links;
  addon_row public.booking_addons;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select link.* into link_row
  from public.booking_addon_confirmation_links as link
  where link.token_hash = p_token_hash
  for update;

  if not found
    or link_row.purpose <> 'booking_addon_confirmation'
    or link_row.used_at is not null
    or link_row.revoked_at is not null
    or link_row.expires_at <= now()
  then
    return false;
  end if;

  select addon.* into addon_row
  from public.booking_addons as addon
  where addon.id = link_row.booking_addon_id;

  if not found or addon_row.status <> 'AWAITING_CUSTOMER' then
    return false;
  end if;

  if link_row.first_opened_at is not null then
    return true;
  end if;

  update public.booking_addon_confirmation_links as link
  set first_opened_at = now()
  where link.id = link_row.id;

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    null,
    link_row.business_id,
    'BOOKING_ADDON_OPENED',
    jsonb_build_object(
      'booking_id', link_row.booking_id,
      'booking_addon_id', link_row.booking_addon_id,
      'confirmation_link_id', link_row.id
    )
  );

  return true;
end;
$$;

create or replace function public.confirm_booking_addon_by_token_hash(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.booking_addon_confirmation_links;
  addon_row public.booking_addons;
  booking_row public.bookings;
  confirmed_time timestamptz := now();
  created_email_event_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select link.* into link_row
  from public.booking_addon_confirmation_links as link
  where link.token_hash = p_token_hash
  for update;

  if not found or link_row.purpose <> 'booking_addon_confirmation' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select addon.* into addon_row
  from public.booking_addons as addon
  where addon.id = link_row.booking_addon_id
    and addon.business_id = link_row.business_id
    and addon.booking_id = link_row.booking_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if addon_row.status = 'CONFIRMED' and link_row.used_at is not null then
    return private.booking_addon_public_view(link_row)
      || jsonb_build_object('status', 'already_confirmed');
  end if;

  if link_row.revoked_at is not null or addon_row.status = 'CANCELLED' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= confirmed_time then
    return jsonb_build_object('status', 'expired');
  end if;

  if addon_row.status <> 'AWAITING_CUSTOMER' or link_row.used_at is not null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.* into booking_row
  from public.bookings as booking
  where booking.id = addon_row.booking_id
    and booking.business_id = addon_row.business_id
  for update;

  if not found or booking_row.status not in ('CONFIRMED', 'IN_PROGRESS') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if addon_row.currency is distinct from booking_row.currency then
    return jsonb_build_object('status', 'unavailable');
  end if;

  perform set_config('app.booking_addon_workflow_allowed', 'true', true);
  update public.booking_addons as addon
  set status = 'CONFIRMED', confirmed_at = confirmed_time
  where addon.id = addon_row.id;

  update public.booking_addon_confirmation_links as link
  set used_at = confirmed_time
  where link.id = link_row.id;

  insert into public.email_events (
    business_id,
    booking_id,
    customer_id,
    booking_addon_id,
    event_type,
    recipient_email
  )
  values (
    addon_row.business_id,
    addon_row.booking_id,
    booking_row.customer_id,
    addon_row.id,
    'BOOKING_ADDON_CONFIRMED',
    addon_row.confirmation_contact_email
  )
  on conflict (booking_addon_id, event_type) do nothing
  returning id into created_email_event_id;

  if created_email_event_id is null then
    select event.id into created_email_event_id
    from public.email_events as event
    where event.booking_addon_id = addon_row.id
      and event.event_type = 'BOOKING_ADDON_CONFIRMED';
  end if;

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    null,
    addon_row.business_id,
    'BOOKING_ADDON_CONFIRMED',
    jsonb_build_object(
      'booking_id', addon_row.booking_id,
      'booking_addon_id', addon_row.id,
      'confirmation_link_id', link_row.id,
      'terms_hash', addon_row.terms_hash,
      'email_event_id', created_email_event_id
    )
  );

  link_row.used_at := confirmed_time;
  return private.booking_addon_public_view(link_row)
    || jsonb_build_object('email_event_id', created_email_event_id);
end;
$$;

do $migration$
declare
  function_sql text;
  original_function_sql text;
begin
  select pg_get_functiondef(
    'public.get_business_insights(uuid,timestamptz,timestamptz)'::regprocedure
  ) into function_sql;

  original_function_sql := function_sql;
  function_sql := replace(
    function_sql,
    'sum(b.total_amount_minor)::bigint as amount_minor',
    'sum(b.total_amount_minor + coalesce((select sum(addon.total_amount_minor) from public.booking_addons addon where addon.business_id = b.business_id and addon.booking_id = b.id and addon.status = ''CONFIRMED''), 0))::bigint as amount_minor'
  );
  if function_sql = original_function_sql then
    raise exception 'Expected analytics total expressions were not found';
  end if;

  original_function_sql := function_sql;
  function_sql := replace(
    function_sql,
    'round(avg(b.total_amount_minor))::bigint as average_minor',
    'round(avg(b.total_amount_minor + coalesce((select sum(addon.total_amount_minor) from public.booking_addons addon where addon.business_id = b.business_id and addon.booking_id = b.id and addon.status = ''CONFIRMED''), 0)))::bigint as average_minor'
  );
  if function_sql = original_function_sql then
    raise exception 'Expected analytics average expression was not found';
  end if;

  original_function_sql := function_sql;
  function_sql := replace(
    function_sql,
    'sum(b.deposit_amount_minor)::bigint as amount_minor',
    'sum(b.deposit_amount_minor + coalesce((select sum(addon.deposit_amount_minor) from public.booking_addons addon where addon.business_id = b.business_id and addon.booking_id = b.id and addon.status = ''CONFIRMED''), 0))::bigint as amount_minor'
  );
  if function_sql = original_function_sql then
    raise exception 'Expected analytics deposit expression was not found';
  end if;

  execute function_sql;
end;
$migration$;

alter table public.booking_addons enable row level security;
alter table public.booking_addon_confirmation_links enable row level security;

revoke all on public.booking_addons from anon, authenticated;
grant select on public.booking_addons to authenticated;
grant select, insert, update, delete on public.booking_addons to service_role;

revoke all on public.booking_addon_confirmation_links from anon, authenticated;
grant select on public.booking_addon_confirmation_links to authenticated;
grant select, insert, update, delete on public.booking_addon_confirmation_links to service_role;

create policy "Members can read booking add-ons"
on public.booking_addons for select to authenticated
using (private.is_business_member(business_id));

create policy "Members can read booking add-on links"
on public.booking_addon_confirmation_links for select to authenticated
using (private.is_business_member(business_id));

revoke all on function private.enforce_booking_addon_integrity()
from public, anon, authenticated;
revoke all on function private.revoke_open_booking_addon_links(uuid, text)
from public, anon, authenticated;
revoke all on function private.cancel_pending_booking_addons(uuid, text, uuid)
from public, anon, authenticated;
revoke all on function private.handle_booking_addon_parent_change()
from public, anon, authenticated;
revoke all on function private.prevent_amendment_with_pending_addon()
from public, anon, authenticated;
revoke all on function private.booking_addon_public_view(public.booking_addon_confirmation_links)
from public, anon, authenticated;

revoke all on function public.create_booking_addon(uuid, text, text, bigint, bigint)
from public, anon, authenticated;
revoke all on function public.submit_booking_addon(uuid, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.cancel_booking_addon(uuid)
from public, anon, authenticated;
revoke all on function public.get_booking_addon_public_view(text)
from public, anon, authenticated;
revoke all on function public.record_booking_addon_open(text)
from public, anon, authenticated;
revoke all on function public.confirm_booking_addon_by_token_hash(text)
from public, anon, authenticated;

grant execute on function public.create_booking_addon(uuid, text, text, bigint, bigint)
to authenticated, service_role;
grant execute on function public.submit_booking_addon(uuid, text, timestamptz)
to authenticated, service_role;
grant execute on function public.cancel_booking_addon(uuid)
to authenticated, service_role;
grant execute on function public.get_booking_addon_public_view(text)
to service_role;
grant execute on function public.record_booking_addon_open(text)
to service_role;
grant execute on function public.confirm_booking_addon_by_token_hash(text)
to service_role;

revoke all on function public.get_business_insights(uuid, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.get_business_insights(uuid, timestamptz, timestamptz)
to authenticated;

notify pgrst, 'reload schema';
