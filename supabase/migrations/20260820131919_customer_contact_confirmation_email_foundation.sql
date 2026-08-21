create type public.email_event_type as enum ('BOOKING_CONFIRMED');
create type public.email_event_status as enum ('PENDING', 'SENDING', 'SENT', 'FAILED');

alter table public.booking_confirmations
  add column contact_email text,
  add column contact_phone text,
  add constraint booking_confirmations_contact_email_format
    check (
      contact_email is null
      or (
        contact_email = lower(trim(contact_email))
        and char_length(contact_email) <= 254
        and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      )
    ),
  add constraint booking_confirmations_contact_phone_format
    check (
      contact_phone is null
      or (
        contact_phone = trim(contact_phone)
        and char_length(contact_phone) between 7 and 32
        and contact_phone ~ '^[0-9+().[:space:]-]+$'
      )
    );

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  customer_id uuid not null,
  booking_confirmation_id uuid not null
    references public.booking_confirmations(id) on delete cascade,
  event_type public.email_event_type not null,
  recipient_email text not null,
  status public.email_event_status not null default 'PENDING',
  attempt_count integer not null default 0,
  provider_message_id text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_attempt_at timestamptz,
  constraint email_events_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint email_events_customer_business_fk
    foreign key (business_id, customer_id)
    references public.customers (business_id, id)
    on delete restrict,
  constraint email_events_confirmation_key unique (booking_confirmation_id),
  constraint email_events_recipient_email_format check (
    recipient_email = lower(trim(recipient_email))
    and char_length(recipient_email) <= 254
    and recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint email_events_attempt_count_nonnegative check (attempt_count >= 0),
  constraint email_events_provider_message_id_length check (
    provider_message_id is null or char_length(provider_message_id) <= 255
  ),
  constraint email_events_failure_code_length check (
    failure_code is null or char_length(failure_code) <= 80
  ),
  constraint email_events_failure_message_length check (
    failure_message is null or char_length(failure_message) <= 500
  ),
  constraint email_events_sent_timestamp_matches_status check (
    (status = 'SENT' and sent_at is not null)
    or (status <> 'SENT' and sent_at is null)
  ),
  constraint email_events_attempt_timestamp_consistency check (
    (attempt_count = 0 and last_attempt_at is null)
    or (attempt_count > 0 and last_attempt_at is not null)
  )
);

create index email_events_business_created_idx
on public.email_events (business_id, created_at desc);

create index email_events_status_created_idx
on public.email_events (status, created_at)
where status in ('PENDING', 'FAILED');

create or replace function private.mask_contact_email(contact_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when contact_email is null or position('@' in contact_email) <= 1 then null
    else left(split_part(contact_email, '@', 1), 1)
      || '***@'
      || split_part(contact_email, '@', 2)
  end;
$$;

create or replace function public.get_confirmation_public_view(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  link_row public.confirmation_links;
  booking_status public.booking_status;
  confirmation_row public.booking_confirmations;
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

    return jsonb_build_object(
      'status', 'already_confirmed',
      'booking', jsonb_build_object(
        'business_name', confirmation_row.terms_snapshot ->> 'business_name',
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

  if booking_status <> 'AWAITING_CUSTOMER' then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  return jsonb_build_object('status', 'valid', 'booking', view_data);
end;
$$;

drop function public.confirm_booking_by_token_hash(text);

create function public.confirm_booking_by_token_hash(
  p_token_hash text,
  p_contact_email text,
  p_contact_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  link_row public.confirmation_links;
  booking_row public.bookings;
  customer_row public.customers;
  business_row public.businesses;
  snapshot jsonb;
  terms_hash text;
  normalized_contact_email text := lower(trim(p_contact_email));
  normalized_contact_phone text := nullif(trim(p_contact_phone), '');
  confirmation_id uuid;
  email_event_id uuid;
  confirmed_time timestamptz := now();
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

  select *
  into link_row
  from public.confirmation_links
  where token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into booking_row
  from public.bookings
  where id = link_row.booking_id
    and business_id = link_row.business_id
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

  select *
  into customer_row
  from public.customers
  where id = booking_row.customer_id
    and business_id = booking_row.business_id
  for update;

  select *
  into business_row
  from public.businesses
  where id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);
  terms_hash := private.booking_terms_hash(snapshot);

  update public.customers
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
  where id = customer_row.id
    and (
      nullif(trim(customer_row.email), '') is null
      or (
        normalized_contact_phone is not null
        and nullif(trim(customer_row.phone), '') is null
      )
    );

  update public.bookings
  set status = 'CONFIRMED',
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = terms_hash,
      confirmation_terms_snapshot = snapshot
  where id = booking_row.id;

  update public.confirmation_links
  set used_at = confirmed_time
  where id = link_row.id;

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
      'phone_provided', normalized_contact_phone is not null
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'confirmed_at', confirmed_time,
    'terms_hash', terms_hash,
    'email_event_id', email_event_id
  );
end;
$$;

create function public.claim_email_event(p_email_event_id uuid)
returns setof public.email_events
language sql
security invoker
set search_path = ''
as $$
  update public.email_events
  set status = 'SENDING',
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      provider_message_id = null,
      failure_code = null,
      failure_message = null,
      sent_at = null
  where id = p_email_event_id
    and status in ('PENDING', 'FAILED')
  returning *;
$$;

alter table public.email_events enable row level security;

revoke all on public.email_events from anon, authenticated;
grant select, insert, update, delete on public.email_events to service_role;

revoke all on function private.mask_contact_email(text) from public, anon, authenticated;
revoke all on function public.get_confirmation_public_view(text) from public, anon, authenticated;
revoke all on function public.confirm_booking_by_token_hash(text, text, text)
from public, anon, authenticated;
revoke all on function public.claim_email_event(uuid) from public, anon, authenticated;

grant execute on function public.get_confirmation_public_view(text) to service_role;
grant execute on function public.confirm_booking_by_token_hash(text, text, text) to service_role;
grant execute on function public.claim_email_event(uuid) to service_role;

notify pgrst, 'reload schema';
