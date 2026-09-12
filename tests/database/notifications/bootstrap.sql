-- Disposable local PostgreSQL only. Minimal dependencies for notification contracts.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema public, auth, private to authenticated, service_role;
create table auth.users(id uuid primary key, deleted_at timestamptz, banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function private.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table public.businesses(id uuid primary key, onboarding_completed_at timestamptz);
create table public.business_members(business_id uuid references public.businesses, user_id uuid references auth.users, status text default 'active', role text default 'owner', primary key(business_id,user_id));
create table public.bookings(id uuid primary key, business_id uuid references public.businesses, scheduled_for timestamptz, status text default 'DRAFT', unique(business_id,id));
create table public.booking_confirmations(id uuid primary key, business_id uuid, booking_id uuid);
create table public.feedback(id uuid primary key, business_id uuid, booking_id uuid);
create table public.booking_amendments(id uuid primary key, business_id uuid, booking_id uuid, status text);
create table public.booking_addons(id uuid primary key, business_id uuid, booking_id uuid, status text);
