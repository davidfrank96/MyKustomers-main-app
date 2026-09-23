-- Synthetic Supabase infrastructure only; never load into a shared database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema extensions;
create schema vault;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table vault.decrypted_secrets(name text, decrypted_secret text);
insert into vault.decrypted_secrets values('mykustomers_whatsapp_capabilities_v1',repeat('a',64)),('mykustomers_feedback_capability_hmac_v1',repeat('b',64));
