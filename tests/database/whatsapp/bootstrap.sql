-- Native disposable PostgreSQL fixture: schema metadata only, no cloud data.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values('20000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002'),('20000000-0000-4000-8000-000000000003');
create schema private;
create schema extensions;
create schema vault;
create extension pgcrypto with schema extensions;
grant usage on schema public,auth,private to authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table vault.decrypted_secrets(name text, decrypted_secret text);
insert into vault.decrypted_secrets values('mykustomers_whatsapp_capabilities_v1',repeat('a',64));
create type public.audit_event_type as enum ('AUTH_SIGNUP', 'AUTH_LOGIN', 'AUTH_LOGOUT', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_UPDATED', 'BUSINESS_CREATED', 'MEMBERSHIP_CREATED', 'BUSINESS_UPDATED', 'CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_ARCHIVED', 'BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_STATUS_CHANGED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'CONFIRMATION_LINK_CREATED', 'CONFIRMATION_LINK_REVOKED', 'CONFIRMATION_LINK_REGENERATED', 'BOOKING_CONFIRMED_BY_CUSTOMER', 'BOOKING_CONFIRMATION_INVALIDATED', 'BOOKING_RESCHEDULED', 'FEEDBACK_LINK_CREATED', 'FEEDBACK_LINK_REVOKED', 'FEEDBACK_LINK_REGENERATED', 'FEEDBACK_SUBMITTED', 'ISSUE_CREATED', 'ISSUE_RESOLVED', 'CONFIRMATION_SHARE_INITIATED', 'CONFIRMATION_OPENED', 'BOOKING_AMENDMENT_SUBMITTED', 'BOOKING_AMENDMENT_REVOKED', 'BOOKING_AMENDMENT_CONFIRMED', 'BOOKING_AMENDMENT_SHARE_INITIATED', 'BOOKING_AMENDMENT_OPENED', 'BOOKING_ADDON_CREATED', 'BOOKING_ADDON_SUBMITTED', 'BOOKING_ADDON_SHARE_INITIATED', 'BOOKING_ADDON_OPENED', 'BOOKING_ADDON_CONFIRMED', 'BOOKING_ADDON_CANCELLED', 'FEEDBACK_SHARE_INITIATED', 'FEEDBACK_OPENED', 'PLATFORM_ADMIN_CREATED', 'PLATFORM_ADMIN_UPDATED', 'PLATFORM_ADMIN_DISABLED', 'PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED', 'PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED', 'PLATFORM_ADMIN_EMAIL_RETRY_FAILED', 'BOOKING_PAYMENT_RECORDED', 'CUSTOMER_DELETED');
create type public.booking_addon_status as enum ('DRAFT', 'AWAITING_CUSTOMER', 'CONFIRMED', 'CANCELLED');
create type public.booking_amendment_status as enum ('PENDING_CUSTOMER', 'CONFIRMED', 'REVOKED');
create type public.booking_currency as enum ('NGN', 'EUR', 'GBP', 'USD');
create type public.booking_issue_category as enum ('LATE_DELIVERY', 'CUSTOMER_REQUESTED_CHANGE', 'PRODUCT_DAMAGED', 'COMMUNICATION_ISSUE', 'PAYMENT_BALANCE_ISSUE', 'NO_SHOW', 'OTHER');
create type public.booking_issue_status as enum ('OPEN', 'RESOLVED');
create type public.booking_status as enum ('DRAFT', 'AWAITING_CUSTOMER', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED');
create type public.business_member_role as enum ('owner', 'member');
create type public.business_member_status as enum ('active');
create type public.email_delivery_attempt_origin as enum ('DOMAIN_EVENT', 'ADMIN_RETRY');
create type public.email_delivery_attempt_status as enum ('SENDING', 'SENT', 'FAILED');
create type public.email_event_status as enum ('PENDING', 'SENDING', 'SENT', 'FAILED');
create type public.email_event_type as enum ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_AMENDMENT_REQUESTED', 'BOOKING_AMENDMENT_CONFIRMED', 'BOOKING_ADDON_REQUESTED', 'BOOKING_ADDON_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_DELIVERED', 'BOOKING_CONFIRMATION_REQUESTED');
create type public.platform_admin_role as enum ('SUPER_ADMIN');
create type public.platform_admin_status as enum ('ACTIVE', 'DISABLED');
create table public.audit_logs ("id" uuid primary key default gen_random_uuid(), "actor_user_id" uuid, "business_id" uuid, "event_type" audit_event_type, "metadata" jsonb, "created_at" timestamp with time zone default now());
create table public.booking_addon_confirmation_links ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "booking_addon_id" uuid, "token_hash" text, "purpose" text, "expires_at" timestamp with time zone, "used_at" timestamp with time zone, "revoked_at" timestamp with time zone, "revoked_reason" text, "first_opened_at" timestamp with time zone, "created_by" uuid, "created_at" timestamp with time zone default now());
create table public.booking_addons ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "created_by" uuid, "title" text, "description" text, "currency" booking_currency, "total_amount_minor" bigint, "deposit_amount_minor" bigint, "status" booking_addon_status, "created_at" timestamp with time zone default now(), "submitted_at" timestamp with time zone, "confirmed_at" timestamp with time zone, "cancelled_at" timestamp with time zone, "cancellation_reason" text, "terms_snapshot" jsonb, "terms_hash" text, "confirmation_contact_email" text, "confirmation_contact_phone" text);
create table public.booking_amendments ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "status" booking_amendment_status, "purpose" text, "token_hash" text, "expires_at" timestamp with time zone, "reason" text, "base_terms_hash" text, "old_terms" jsonb, "proposed_terms" jsonb, "proposed_terms_hash" text, "changed_fields" text[], "contact_email" text, "contact_phone" text, "proposed_by" uuid, "created_at" timestamp with time zone default now(), "submitted_at" timestamp with time zone, "first_opened_at" timestamp with time zone, "confirmed_at" timestamp with time zone, "revoked_at" timestamp with time zone, "revoked_reason" text, "effective_terms" jsonb, "effective_terms_hash" text);
create table public.booking_changes ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "changed_by" uuid, "change_type" text, "previous_scheduled_for" timestamp with time zone, "new_scheduled_for" timestamp with time zone, "created_at" timestamp with time zone default now(), "amendment_id" uuid, "old_terms" jsonb, "new_terms" jsonb, "changed_fields" text[]);
create table public.booking_confirmations ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "confirmation_link_id" uuid, "terms_hash" text, "terms_snapshot" jsonb, "confirmed_at" timestamp with time zone, "contact_email" text, "contact_phone" text);
create table public.booking_payments ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "operation_id" uuid, "amount_minor" bigint, "recorded_by" uuid, "recorded_at" timestamp with time zone, "created_at" timestamp with time zone default now());
create table public.bookings ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "customer_id" uuid, "reference" text, "title" text, "description" text, "currency" booking_currency, "total_amount_minor" bigint, "deposit_amount_minor" bigint, "scheduled_for" timestamp with time zone, "status" booking_status, "internal_notes" text, "created_by" uuid, "created_at" timestamp with time zone default now(), "updated_at" timestamp with time zone default now(), "cancelled_at" timestamp with time zone, "completed_at" timestamp with time zone, "customer_confirmed_at" timestamp with time zone, "confirmation_terms_hash" text, "confirmation_terms_snapshot" jsonb, "started_at" timestamp with time zone, "ready_at" timestamp with time zone, "delivered_at" timestamp with time zone, "cancellation_reason" text);
create table public.business_members ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "user_id" uuid, "role" business_member_role, "status" business_member_status, "created_at" timestamp with time zone default now(), "updated_at" timestamp with time zone default now());
create table public.businesses ("id" uuid primary key default gen_random_uuid(), "name" text, "created_by" uuid, "created_at" timestamp with time zone default now(), "updated_at" timestamp with time zone default now(), "slug" text, "category" text, "description" text, "phone" text, "email" text, "whatsapp" text, "instagram" text, "address_text" text, "onboarding_completed_at" timestamp with time zone, "website" text, "logo_path" text);
create table public.confirmation_links ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "token_hash" text, "purpose" text, "expires_at" timestamp with time zone, "used_at" timestamp with time zone, "revoked_at" timestamp with time zone, "revoked_reason" text, "created_by" uuid, "created_at" timestamp with time zone default now(), "first_opened_at" timestamp with time zone);
create table public.customers ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "name" text, "email" text, "phone" text, "notes" text, "archived_at" timestamp with time zone, "created_at" timestamp with time zone default now(), "updated_at" timestamp with time zone default now());
create table public.email_events ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "customer_id" uuid, "booking_confirmation_id" uuid, "event_type" email_event_type, "recipient_email" text, "status" email_event_status, "attempt_count" integer, "provider_message_id" text, "failure_code" text, "failure_message" text, "created_at" timestamp with time zone default now(), "sent_at" timestamp with time zone, "last_attempt_at" timestamp with time zone, "booking_amendment_id" uuid, "booking_addon_id" uuid, "booking_addon_confirmation_link_id" uuid, "booking_change_id" uuid, "confirmation_link_id" uuid, "feedback_link_id" uuid);
create table public.feedback ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "customer_id" uuid, "feedback_link_id" uuid, "overall_rating" integer, "on_time" boolean, "met_expectations" boolean, "comment" text, "submitted_at" timestamp with time zone, "created_at" timestamp with time zone default now());
create table public.feedback_links ("id" uuid primary key default gen_random_uuid(), "business_id" uuid, "booking_id" uuid, "token_hash" text, "purpose" text, "expires_at" timestamp with time zone, "used_at" timestamp with time zone, "revoked_at" timestamp with time zone, "revoked_reason" text, "created_by" uuid, "created_at" timestamp with time zone default now(), "first_opened_at" timestamp with time zone, "token_version" smallint);
create table public.platform_admins ("user_id" uuid, "role" platform_admin_role, "status" platform_admin_status, "created_at" timestamp with time zone default now(), "updated_at" timestamp with time zone default now(), "created_by" uuid, "updated_by" uuid);
alter table public.bookings add unique(business_id,id);
alter table public.email_events alter column status set default 'PENDING';
alter table public.email_events add unique(booking_confirmation_id,event_type);
alter table public.email_events add unique(booking_amendment_id,event_type);
create unique index email_request_unique on public.email_events(confirmation_link_id) where event_type='BOOKING_CONFIRMATION_REQUESTED';
create unique index email_addon_confirmed_unique on public.email_events(booking_addon_id,event_type) where event_type='BOOKING_ADDON_CONFIRMED';
create unique index email_addon_request_unique on public.email_events(booking_addon_confirmation_link_id,event_type) where event_type='BOOKING_ADDON_REQUESTED';
create unique index email_reschedule_unique on public.email_events(booking_change_id,event_type) where event_type='BOOKING_RESCHEDULED';
create function private.is_business_member(p_business_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.business_members where business_id=p_business_id and user_id=auth.uid() and status='active') $$;
create function private.normalize_customer_contact_email(p_email text) returns text language sql immutable as $$ select split_part(trim(p_email),'@',1)||'@'||lower(split_part(trim(p_email),'@',2)) $$;
CREATE OR REPLACE FUNCTION public.confirm_booking_addon_by_token_hash(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.confirm_booking_addon_by_token_hash(text) from public,anon,authenticated,service_role;
grant execute on function public.confirm_booking_addon_by_token_hash(text) to service_role;
CREATE OR REPLACE FUNCTION public.confirm_booking_amendment_by_token_hash(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.confirm_booking_amendment_by_token_hash(text) from public,anon,authenticated,service_role;
grant execute on function public.confirm_booking_amendment_by_token_hash(text) to service_role;
CREATE OR REPLACE FUNCTION public.confirm_booking_by_token_hash(p_token_hash text, p_contact_email text, p_contact_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.confirm_booking_by_token_hash(text, text, text) from public,anon,authenticated,service_role;
grant execute on function public.confirm_booking_by_token_hash(text, text, text) to service_role;
CREATE OR REPLACE FUNCTION public.create_booking_amendment(p_booking_id uuid, p_reason text, p_title text, p_description text, p_currency booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(amendment_id uuid, expires_at timestamp with time zone, replaced_amendment_count integer, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.create_booking_amendment(uuid, text, text, text, booking_currency, bigint, bigint, timestamp with time zone, text, timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_amendment(uuid, text, text, text, booking_currency, bigint, bigint, timestamp with time zone, text, timestamp with time zone) to authenticated;
CREATE OR REPLACE FUNCTION public.create_booking_confirmation_request(p_booking_id uuid, p_contact_email text, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(confirmation_link_id uuid, email_event_id uuid, recipient_email text, expires_at timestamp with time zone, replaced_link_count integer, request_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.create_booking_confirmation_request(uuid, text, text, timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_confirmation_request(uuid, text, text, timestamp with time zone) to authenticated;
CREATE OR REPLACE FUNCTION public.create_booking_with_customer(p_customer_mode text, p_customer_id uuid, p_new_customer_name text, p_new_customer_email text, p_new_customer_phone text, p_title text, p_description text, p_currency booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_internal_notes text)
 RETURNS TABLE(booking_id uuid, customer_id uuid, customer_created boolean, reference text, status booking_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.create_booking_with_customer(text, uuid, text, text, text, text, text, booking_currency, bigint, bigint, timestamp with time zone, text) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_with_customer(text, uuid, text, text, text, text, text, booking_currency, bigint, bigint, timestamp with time zone, text) to authenticated;
CREATE OR REPLACE FUNCTION public.create_booking_with_customer(p_business_id uuid, p_customer_mode text, p_customer_id uuid, p_new_customer_name text, p_new_customer_email text, p_new_customer_phone text, p_title text, p_description text, p_currency booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_internal_notes text)
 RETURNS TABLE(booking_id uuid, customer_id uuid, customer_created boolean, reference text, status booking_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.create_booking_with_customer(uuid, text, uuid, text, text, text, text, text, booking_currency, bigint, bigint, timestamp with time zone, text) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_with_customer(uuid, text, uuid, text, text, text, text, text, booking_currency, bigint, bigint, timestamp with time zone, text) to authenticated;
CREATE OR REPLACE FUNCTION public.deliver_booking_with_feedback(p_booking_id uuid)
 RETURNS TABLE(booking_id uuid, booking_status booking_status, email_event_id uuid, feedback_link_id uuid, feedback_token text, expires_at timestamp with time zone, reused boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.deliver_booking_with_feedback(uuid) from public,anon,authenticated,service_role;
grant execute on function public.deliver_booking_with_feedback(uuid) to authenticated;
CREATE OR REPLACE FUNCTION public.reschedule_booking_with_notification(p_booking_id uuid, p_scheduled_for timestamp with time zone, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_id uuid, previous_scheduled_for timestamp with time zone, new_scheduled_for timestamp with time zone, status booking_status, confirmation_link_id uuid, expires_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.reschedule_booking_with_notification(uuid, timestamp with time zone, text, timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.reschedule_booking_with_notification(uuid, timestamp with time zone, text, timestamp with time zone) to authenticated;
CREATE OR REPLACE FUNCTION public.submit_booking_addon(p_booking_addon_id uuid, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_addon_id uuid, confirmation_link_id uuid, expires_at timestamp with time zone, replaced_link_count integer, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.submit_booking_addon(uuid, text, timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.submit_booking_addon(uuid, text, timestamp with time zone) to authenticated;
CREATE OR REPLACE FUNCTION public.transition_booking_status(p_booking_id uuid, p_to_status booking_status, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS TABLE(booking_id uuid, from_status booking_status, to_status booking_status, changed_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin raise exception 'fixture_baseline'; end $function$;
revoke all on function public.transition_booking_status(uuid, booking_status, text) from public,anon,authenticated,service_role;
grant execute on function public.transition_booking_status(uuid, booking_status, text) to authenticated;
