create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create type public.business_member_role as enum ('owner', 'member');
create type public.business_member_status as enum ('active');
create type public.audit_event_type as enum (
  'AUTH_SIGNUP',
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_UPDATED',
  'BUSINESS_CREATED',
  'MEMBERSHIP_CREATED'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 120)
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_name_length check (char_length(name) between 1 and 160)
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_member_role not null,
  status public.business_member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_members_unique_business_user unique (business_id, user_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  event_type public.audit_event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index profiles_updated_at_idx on public.profiles (updated_at);
create index businesses_created_by_idx on public.businesses (created_by);
create index business_members_user_status_idx on public.business_members (user_id, status);
create index business_members_business_status_idx on public.business_members (business_id, status);
create index business_members_role_idx on public.business_members (business_id, role);
create index audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);
create index audit_logs_event_created_idx on public.audit_logs (event_type, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function private.set_updated_at();

create trigger business_members_set_updated_at
before update on public.business_members
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  requested_display_name text;
begin
  requested_display_name := nullif(trim(new.raw_user_meta_data->>'display_name'), '');

  insert into public.profiles (id, display_name)
  values (new.id, requested_display_name)
  on conflict (id) do nothing;

  insert into public.audit_logs (actor_user_id, event_type, metadata)
  values (new.id, 'AUTH_SIGNUP', jsonb_build_object('source', 'auth_trigger'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
  );
$$;

create or replace function private.has_business_role(
  target_business_id uuid,
  allowed_roles public.business_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.audit_logs enable row level security;

revoke all on schema private from public;
grant usage on schema private to authenticated;

revoke all on public.profiles from anon, authenticated;
revoke all on public.businesses from anon, authenticated;
revoke all on public.business_members from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.businesses to authenticated;
grant select on public.business_members to authenticated;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_business_member(uuid) from public, anon, authenticated;
revoke all on function private.has_business_role(uuid, public.business_member_role[]) from public, anon, authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.has_business_role(uuid, public.business_member_role[]) to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Members can read their businesses"
on public.businesses
for select
to authenticated
using (private.is_business_member(id));

create policy "Owners can update their businesses"
on public.businesses
for update
to authenticated
using (private.has_business_role(id, array['owner']::public.business_member_role[]))
with check (private.has_business_role(id, array['owner']::public.business_member_role[]));

create policy "Members can read memberships for their businesses"
on public.business_members
for select
to authenticated
using (private.is_business_member(business_id));
