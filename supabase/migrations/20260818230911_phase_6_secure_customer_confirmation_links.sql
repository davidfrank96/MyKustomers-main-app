alter type public.booking_status add value if not exists 'AWAITING_CUSTOMER' after 'DRAFT';

alter type public.audit_event_type add value if not exists 'CONFIRMATION_LINK_CREATED';
alter type public.audit_event_type add value if not exists 'CONFIRMATION_LINK_REVOKED';
alter type public.audit_event_type add value if not exists 'CONFIRMATION_LINK_REGENERATED';
alter type public.audit_event_type add value if not exists 'BOOKING_CONFIRMED_BY_CUSTOMER';
alter type public.audit_event_type add value if not exists 'BOOKING_CONFIRMATION_INVALIDATED';

alter table public.bookings
  add column if not exists customer_confirmed_at timestamptz,
  add column if not exists confirmation_terms_hash text,
  add column if not exists confirmation_terms_snapshot jsonb;

create table if not exists public.confirmation_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  token_hash text not null,
  purpose text not null default 'booking_confirmation',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint confirmation_links_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint confirmation_links_token_hash_key unique (token_hash),
  constraint confirmation_links_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint confirmation_links_purpose_check check (purpose = 'booking_confirmation'),
  constraint confirmation_links_expires_after_created check (expires_at > created_at),
  constraint confirmation_links_used_after_created check (used_at is null or used_at >= created_at),
  constraint confirmation_links_revoked_after_created check (revoked_at is null or revoked_at >= created_at),
  constraint confirmation_links_revoked_reason_length check (revoked_reason is null or char_length(revoked_reason) <= 80)
);

create unique index if not exists confirmation_links_one_open_link_per_booking_idx
on public.confirmation_links (booking_id)
where used_at is null and revoked_at is null;

create index if not exists confirmation_links_business_idx
on public.confirmation_links (business_id, created_at desc);

create index if not exists confirmation_links_booking_idx
on public.confirmation_links (booking_id, created_at desc);

create index if not exists confirmation_links_expires_idx
on public.confirmation_links (expires_at);

create table if not exists public.booking_confirmations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  confirmation_link_id uuid not null references public.confirmation_links(id) on delete restrict,
  terms_hash text not null,
  terms_snapshot jsonb not null,
  confirmed_at timestamptz not null default now(),
  constraint booking_confirmations_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_confirmations_link_key unique (confirmation_link_id),
  constraint booking_confirmations_terms_hash_format check (terms_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists booking_confirmations_booking_idx
on public.booking_confirmations (business_id, booking_id, confirmed_at desc);

create table if not exists public.confirmation_rate_limits (
  bucket_key text not null,
  action text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (bucket_key, action),
  constraint confirmation_rate_limits_bucket_key_format check (bucket_key ~ '^[a-f0-9]{64}$'),
  constraint confirmation_rate_limits_action_length check (char_length(action) between 1 and 80),
  constraint confirmation_rate_limits_request_count_nonnegative check (request_count >= 0)
);

create index if not exists confirmation_rate_limits_blocked_until_idx
on public.confirmation_rate_limits (blocked_until);

create or replace function private.booking_material_terms_changed(
  old_booking public.bookings,
  new_booking public.bookings
)
returns boolean
language sql
stable
set search_path = public
as $$
  select old_booking.title is distinct from new_booking.title
    or old_booking.description is distinct from new_booking.description
    or old_booking.currency is distinct from new_booking.currency
    or old_booking.total_amount_minor is distinct from new_booking.total_amount_minor
    or old_booking.deposit_amount_minor is distinct from new_booking.deposit_amount_minor
    or old_booking.scheduled_for is distinct from new_booking.scheduled_for;
$$;

create or replace function private.booking_terms_snapshot(
  booking_row public.bookings,
  customer_row public.customers,
  business_row public.businesses
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'business_name', business_row.name,
    'customer_name', customer_row.name,
    'booking_reference', booking_row.reference,
    'title', booking_row.title,
    'description', booking_row.description,
    'currency', booking_row.currency,
    'total_amount_minor', booking_row.total_amount_minor,
    'deposit_amount_minor', booking_row.deposit_amount_minor,
    'balance_amount_minor', booking_row.total_amount_minor - booking_row.deposit_amount_minor,
    'scheduled_for', booking_row.scheduled_for
  ));
$$;

create or replace function private.booking_terms_hash(snapshot jsonb)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(snapshot::text, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.customer_confirmation_view(
  link_row public.confirmation_links
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  booking_row public.bookings;
  customer_row public.customers;
  business_row public.businesses;
  snapshot jsonb;
begin
  select *
  into booking_row
  from public.bookings
  where id = link_row.booking_id
    and business_id = link_row.business_id;

  if not found then
    return null;
  end if;

  select *
  into customer_row
  from public.customers
  where id = booking_row.customer_id
    and business_id = booking_row.business_id;

  select *
  into business_row
  from public.businesses
  where id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return null;
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);

  return jsonb_build_object(
    'business_name', business_row.name,
    'business_phone', business_row.phone,
    'business_email', business_row.email,
    'customer_name', customer_row.name,
    'booking_reference', booking_row.reference,
    'booking_title', booking_row.title,
    'booking_description', booking_row.description,
    'scheduled_for', booking_row.scheduled_for,
    'currency', booking_row.currency,
    'total_amount_minor', booking_row.total_amount_minor,
    'deposit_amount_minor', booking_row.deposit_amount_minor,
    'balance_amount_minor', booking_row.total_amount_minor - booking_row.deposit_amount_minor,
    'status', booking_row.status,
    'expires_at', link_row.expires_at,
    'confirmed_at', booking_row.customer_confirmed_at,
    'terms_hash', private.booking_terms_hash(snapshot)
  );
end;
$$;

create or replace function private.revoke_open_confirmation_links(
  target_booking_id uuid,
  reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  revoked_count integer;
begin
  update public.confirmation_links
  set revoked_at = coalesce(revoked_at, now()),
      revoked_reason = reason
  where booking_id = target_booking_id
    and used_at is null
    and revoked_at is null;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

create or replace function private.enforce_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  material_changed boolean := false;
begin
  caller_user_id := auth.uid();

  if tg_op = 'INSERT' then
    if caller_user_id is not null and new.created_by is distinct from caller_user_id then
      raise exception 'booking_created_by_must_match_authenticated_user'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED' then
      raise exception 'booking_cannot_start_confirmed'
        using errcode = '23000';
    end if;

    if new.status = 'CANCELLED' and new.cancelled_at is null then
      new.cancelled_at := now();
    elsif new.status <> 'CANCELLED' then
      new.cancelled_at := null;
    end if;

    if new.status = 'COMPLETED' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status <> 'COMPLETED' then
      new.completed_at := null;
    end if;

    if new.status in ('DRAFT', 'AWAITING_CUSTOMER', 'CANCELLED') then
      new.customer_confirmed_at := null;
      new.confirmation_terms_hash := null;
      new.confirmation_terms_snapshot := null;
    end if;

    return new;
  end if;

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

  if material_changed and old.status in ('IN_PROGRESS', 'READY', 'DELIVERED') then
    raise exception 'material_changes_not_allowed_after_work_started'
      using errcode = '23000';
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
      or (old.status = 'READY' and new.status = 'DELIVERED')
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

    if new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.completed_at := null;
      perform private.revoke_open_confirmation_links(old.id, 'booking_cancelled');
    elsif new.status = 'COMPLETED' then
      new.completed_at := coalesce(new.completed_at, now());
      new.cancelled_at := null;
    else
      new.cancelled_at := null;
      new.completed_at := null;
    end if;
  else
    if old.cancelled_at is distinct from new.cancelled_at
      or old.completed_at is distinct from new.completed_at
    then
      raise exception 'terminal_timestamps_follow_status'
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

create or replace function public.create_booking_confirmation_link(
  p_booking_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '24 hours'
)
returns table (
  confirmation_link_id uuid,
  expires_at timestamptz,
  replaced_link_count integer
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  revoked_count integer;
  inserted_link_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() then
    raise exception 'confirmation_link_expiration_must_be_future'
      using errcode = '22023';
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

  if booking_row.status not in ('DRAFT', 'AWAITING_CUSTOMER') then
    raise exception 'booking_not_eligible_for_confirmation_link'
      using errcode = '23000';
  end if;

  revoked_count := private.revoke_open_confirmation_links(booking_row.id, 'regenerated');

  if booking_row.status = 'DRAFT' then
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

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    case when revoked_count > 0 then 'CONFIRMATION_LINK_REGENERATED'::public.audit_event_type else 'CONFIRMATION_LINK_CREATED'::public.audit_event_type end,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_link_id', inserted_link_id,
      'expires_at', p_expires_at,
      'replaced_link_count', revoked_count
    )
  );

  return query select inserted_link_id, p_expires_at, revoked_count;
end;
$$;

create or replace function public.revoke_booking_confirmation_link(
  p_booking_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  revoked_count integer;
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

  revoked_count := private.revoke_open_confirmation_links(booking_row.id, 'vendor_revoked');

  if revoked_count > 0 then
    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      caller_user_id,
      booking_row.business_id,
      'CONFIRMATION_LINK_REVOKED',
      jsonb_build_object('booking_id', booking_row.id, 'revoked_link_count', revoked_count)
    );
  end if;

  return revoked_count;
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
        'terms_hash', confirmation_row.terms_hash
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

create or replace function public.confirm_booking_by_token_hash(
  p_token_hash text
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
  confirmed_time timestamptz := now();
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
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
    and business_id = booking_row.business_id;

  select *
  into business_row
  from public.businesses
  where id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);
  terms_hash := private.booking_terms_hash(snapshot);

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
    confirmed_at
  )
  values (
    booking_row.business_id,
    booking_row.id,
    link_row.id,
    terms_hash,
    snapshot,
    confirmed_time
  )
  on conflict (confirmation_link_id) do nothing;

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
      'terms_hash', terms_hash
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'confirmed_at', confirmed_time,
    'terms_hash', terms_hash
  );
end;
$$;

create or replace function public.consume_confirmation_rate_limit(
  p_bucket_key text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer,
  p_block_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.confirmation_rate_limits;
  v_now timestamptz := now();
  next_count integer;
begin
  if p_bucket_key !~ '^[a-f0-9]{64}$'
    or char_length(p_action) < 1
    or char_length(p_action) > 80
    or p_max_requests < 1
    or p_window_seconds < 1
    or p_block_seconds < 1
  then
    return false;
  end if;

  select *
  into existing
  from public.confirmation_rate_limits
  where bucket_key = p_bucket_key
    and action = p_action
  for update;

  if found and existing.blocked_until is not null and existing.blocked_until > v_now then
    return false;
  end if;

  if not found then
    insert into public.confirmation_rate_limits (
      bucket_key,
      action,
      window_start,
      request_count,
      updated_at
    )
    values (p_bucket_key, p_action, v_now, 1, v_now);
    return true;
  end if;

  if existing.window_start + make_interval(secs => p_window_seconds) <= v_now then
    update public.confirmation_rate_limits
    set window_start = v_now,
        request_count = 1,
        blocked_until = null,
        updated_at = v_now
    where bucket_key = p_bucket_key
      and action = p_action;
    return true;
  end if;

  next_count := existing.request_count + 1;

  update public.confirmation_rate_limits
  set request_count = next_count,
      blocked_until = case
        when next_count > p_max_requests then v_now + make_interval(secs => p_block_seconds)
        else null
      end,
      updated_at = v_now
  where bucket_key = p_bucket_key
    and action = p_action;

  return next_count <= p_max_requests;
end;
$$;

drop trigger if exists bookings_enforce_integrity on public.bookings;
create trigger bookings_enforce_integrity
before insert or update on public.bookings
for each row execute function private.enforce_booking_integrity();

alter table public.confirmation_links enable row level security;
alter table public.booking_confirmations enable row level security;
alter table public.confirmation_rate_limits enable row level security;

revoke all on public.confirmation_links from anon, authenticated;
revoke all on public.booking_confirmations from anon, authenticated;
revoke all on public.confirmation_rate_limits from anon, authenticated;

grant select, insert, update, delete on public.confirmation_links to service_role;
grant select, insert, update, delete on public.booking_confirmations to service_role;
grant select, insert, update, delete on public.confirmation_rate_limits to service_role;

revoke all on function private.booking_material_terms_changed(public.bookings, public.bookings) from public, anon, authenticated;
revoke all on function private.booking_terms_snapshot(public.bookings, public.customers, public.businesses) from public, anon, authenticated;
revoke all on function private.booking_terms_hash(jsonb) from public, anon, authenticated;
revoke all on function private.customer_confirmation_view(public.confirmation_links) from public, anon, authenticated;
revoke all on function private.revoke_open_confirmation_links(uuid, text) from public, anon, authenticated;
revoke all on function private.enforce_booking_integrity() from public, anon, authenticated;

revoke all on function public.create_booking_confirmation_link(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_booking_confirmation_link(uuid) from public, anon, authenticated;
revoke all on function public.get_confirmation_public_view(text) from public, anon, authenticated;
revoke all on function public.confirm_booking_by_token_hash(text) from public, anon, authenticated;
revoke all on function public.consume_confirmation_rate_limit(text, text, integer, integer, integer) from public, anon, authenticated;

grant execute on function public.create_booking_confirmation_link(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_booking_confirmation_link(uuid) to authenticated;
grant execute on function public.get_confirmation_public_view(text) to service_role;
grant execute on function public.confirm_booking_by_token_hash(text) to service_role;
grant execute on function public.consume_confirmation_rate_limit(text, text, integer, integer, integer) to service_role;

notify pgrst, 'reload schema';
