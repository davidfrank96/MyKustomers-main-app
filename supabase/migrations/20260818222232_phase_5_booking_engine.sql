create type public.booking_status as enum (
  'DRAFT',
  'CONFIRMED',
  'IN_PROGRESS',
  'READY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
);

create type public.booking_currency as enum ('NGN', 'EUR', 'GBP', 'USD');

alter type public.audit_event_type add value if not exists 'BOOKING_CREATED';
alter type public.audit_event_type add value if not exists 'BOOKING_UPDATED';
alter type public.audit_event_type add value if not exists 'BOOKING_STATUS_CHANGED';
alter type public.audit_event_type add value if not exists 'BOOKING_CANCELLED';
alter type public.audit_event_type add value if not exists 'BOOKING_COMPLETED';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_business_id_id_key'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_business_id_id_key unique (business_id, id);
  end if;
end $$;

create or replace function private.generate_booking_reference()
returns text
language plpgsql
set search_path = public, extensions
as $$
begin
  return 'MC-' || to_char(now(), 'YYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(3), 'hex'));
end;
$$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  reference text not null default private.generate_booking_reference(),
  title text not null,
  description text,
  currency public.booking_currency not null default 'NGN',
  total_amount_minor bigint not null,
  deposit_amount_minor bigint not null default 0,
  scheduled_for timestamptz,
  status public.booking_status not null default 'DRAFT',
  internal_notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  constraint bookings_business_customer_fk
    foreign key (business_id, customer_id)
    references public.customers (business_id, id)
    on delete restrict,
  constraint bookings_business_id_id_key unique (business_id, id),
  constraint bookings_reference_key unique (reference),
  constraint bookings_reference_format check (reference ~ '^MC-[0-9]{6}-[A-F0-9]{6}$'),
  constraint bookings_title_length check (char_length(title) between 1 and 160),
  constraint bookings_description_length check (description is null or char_length(description) <= 5000),
  constraint bookings_internal_notes_length check (internal_notes is null or char_length(internal_notes) <= 5000),
  constraint bookings_total_amount_nonnegative check (total_amount_minor >= 0),
  constraint bookings_deposit_amount_nonnegative check (deposit_amount_minor >= 0),
  constraint bookings_deposit_not_greater_than_total check (deposit_amount_minor <= total_amount_minor),
  constraint bookings_cancelled_timestamp_matches_status check (
    (status = 'CANCELLED' and cancelled_at is not null)
    or (status <> 'CANCELLED' and cancelled_at is null)
  ),
  constraint bookings_completed_timestamp_matches_status check (
    (status = 'COMPLETED' and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  )
);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  business_id uuid not null,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint booking_status_history_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_status_history_transition_changed check (from_status is null or from_status <> to_status)
);

create index if not exists bookings_business_created_idx
on public.bookings (business_id, created_at desc);

create index if not exists bookings_business_status_idx
on public.bookings (business_id, status, created_at desc);

create index if not exists bookings_business_scheduled_idx
on public.bookings (business_id, scheduled_for);

create index if not exists bookings_business_customer_idx
on public.bookings (business_id, customer_id, created_at desc);

create index if not exists bookings_reference_idx
on public.bookings (reference);

create index if not exists booking_status_history_booking_idx
on public.booking_status_history (business_id, booking_id, changed_at desc);

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function private.set_updated_at();

create or replace function private.enforce_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
begin
  caller_user_id := auth.uid();

  if tg_op = 'INSERT' then
    if caller_user_id is not null and new.created_by is distinct from caller_user_id then
      raise exception 'booking_created_by_must_match_authenticated_user'
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

    return new;
  end if;

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

  if old.status is distinct from new.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('CONFIRMED', 'CANCELLED'))
      or (old.status = 'CONFIRMED' and new.status in ('IN_PROGRESS', 'CANCELLED'))
      or (old.status = 'IN_PROGRESS' and new.status in ('READY', 'CANCELLED'))
      or (old.status = 'READY' and new.status = 'DELIVERED')
      or (old.status = 'DELIVERED' and new.status = 'COMPLETED')
    ) then
      raise exception 'invalid_booking_status_transition'
        using errcode = '23000';
    end if;

    if new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.completed_at := null;
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
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_integrity on public.bookings;
create trigger bookings_enforce_integrity
before insert or update on public.bookings
for each row execute function private.enforce_booking_integrity();

create or replace function private.record_booking_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (
      booking_id,
      business_id,
      from_status,
      to_status,
      changed_by
    )
    values (new.id, new.business_id, null, new.status, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.booking_status_history (
      booking_id,
      business_id,
      from_status,
      to_status,
      changed_by
    )
    values (new.id, new.business_id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_record_status_history on public.bookings;
create trigger bookings_record_status_history
after insert or update on public.bookings
for each row execute function private.record_booking_status_history();

alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;

revoke all on public.bookings from anon, authenticated;
revoke all on public.booking_status_history from anon, authenticated;

grant select, insert, update on public.bookings to authenticated;
grant select on public.booking_status_history to authenticated;

grant select, insert, update, delete on public.bookings to service_role;
grant select, insert, update, delete on public.booking_status_history to service_role;

revoke all on function private.generate_booking_reference() from public, anon, authenticated;
revoke all on function private.enforce_booking_integrity() from public, anon, authenticated;
revoke all on function private.record_booking_status_history() from public, anon, authenticated;
grant execute on function private.generate_booking_reference() to authenticated, service_role;

create policy "Members can read their bookings"
on public.bookings
for select
to authenticated
using (private.is_business_member(business_id));

create policy "Members can create bookings for their businesses"
on public.bookings
for insert
to authenticated
with check (
  private.is_business_member(business_id)
  and created_by = (select auth.uid())
);

create policy "Members can update bookings for their businesses"
on public.bookings
for update
to authenticated
using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

create policy "Members can read booking status history"
on public.booking_status_history
for select
to authenticated
using (private.is_business_member(business_id));

notify pgrst, 'reload schema';
