alter type public.audit_event_type add value if not exists 'CUSTOMER_CREATED';
alter type public.audit_event_type add value if not exists 'CUSTOMER_UPDATED';
alter type public.audit_event_type add value if not exists 'CUSTOMER_ARCHIVED';

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_length check (char_length(name) between 1 and 160),
  constraint customers_email_format
    check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  constraint customers_phone_format
    check (phone is null or (char_length(phone) between 7 and 32 and phone ~ '^[0-9+().[:space:]-]+$')),
  constraint customers_notes_length
    check (notes is null or char_length(notes) <= 5000),
  constraint customers_archived_after_created
    check (archived_at is null or archived_at >= created_at)
);

create index if not exists customers_business_created_idx
on public.customers (business_id, created_at desc);

create index if not exists customers_business_archived_idx
on public.customers (business_id, archived_at);

create index if not exists customers_business_name_idx
on public.customers (business_id, lower(name));

create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_updated_at();

create or replace function private.prevent_customer_business_id_change()
returns trigger
language plpgsql
as $$
begin
  if old.business_id is distinct from new.business_id then
    raise exception 'customer_business_id_immutable'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

drop trigger if exists customers_prevent_business_id_change on public.customers;
create trigger customers_prevent_business_id_change
before update on public.customers
for each row execute function private.prevent_customer_business_id_change();

alter table public.customers enable row level security;

revoke all on public.customers from anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update, delete on public.customers to service_role;

revoke all on function private.prevent_customer_business_id_change() from public, anon, authenticated;

create policy "Members can read their customers"
on public.customers
for select
to authenticated
using (private.is_business_member(business_id));

create policy "Members can create customers for their businesses"
on public.customers
for insert
to authenticated
with check (private.is_business_member(business_id));

create policy "Members can update customers for their businesses"
on public.customers
for update
to authenticated
using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

notify pgrst, 'reload schema';
