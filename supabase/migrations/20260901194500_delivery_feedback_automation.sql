-- MY KUSTOMERS — delivery-to-feedback automation
-- Design artifact only. Do not apply without final approval.
--
-- Required pre-provisioned Supabase Vault secret (not created here):
--   name:  mykustomers_feedback_capability_hmac_v1
--   value: exactly 64 lowercase hexadecimal characters generated from 32 random bytes
--
-- Version 0 rows are historical random capabilities and remain public-valid.
-- Version 1 rows are deterministic HMAC-SHA-256 capabilities whose plaintext token
-- is reconstructed only inside narrowly granted SECURITY DEFINER functions.

begin;

-- Fail closed on drift and missing key material. The key is never returned or logged.
do $migration_precheck$
declare
  v_secret_count integer;
  v_secret text;
begin
  if to_regclass('public.feedback_links') is null
    or to_regclass('public.feedback') is null
    or to_regclass('public.email_events') is null
    or to_regclass('public.bookings') is null
  then
    raise exception 'delivery_feedback_precheck_missing_required_table';
  end if;

  if to_regprocedure(
    'public.transition_booking_status(uuid,public.booking_status,text)'
  ) is null
    or to_regprocedure('private.booking_payment_totals(uuid,uuid)') is null
    or to_regprocedure('private.is_business_member(uuid)') is null
  then
    raise exception 'delivery_feedback_precheck_missing_required_function';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_extension as extension
    where extension.extname = 'pgcrypto'
  ) or to_regprocedure('extensions.hmac(text,text,text)') is null
    or to_regprocedure('extensions.digest(text,text)') is null
    or to_regprocedure('extensions.gen_random_uuid()') is null
  then
    raise exception 'delivery_feedback_precheck_pgcrypto_unavailable';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_extension as extension
    where extension.extname = 'supabase_vault'
  ) or to_regclass('vault.decrypted_secrets') is null
  then
    raise exception 'delivery_feedback_precheck_vault_unavailable';
  end if;

  select count(*), max(secret.decrypted_secret)
  into v_secret_count, v_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'mykustomers_feedback_capability_hmac_v1';

  if v_secret_count <> 1 then
    raise exception 'delivery_feedback_v1_secret_missing_or_duplicated';
  end if;

  if v_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'delivery_feedback_v1_secret_invalid_format';
  end if;
end;
$migration_precheck$;

alter table public.feedback_links
  add column token_version smallint not null default 0,
  add constraint feedback_links_token_version_check
    check (token_version in (0, 1)),
  add constraint feedback_links_business_booking_id_key
    unique (business_id, booking_id, id);

alter table public.email_events
  add column feedback_link_id uuid,
  add constraint email_events_feedback_link_business_booking_fk
    foreign key (business_id, booking_id, feedback_link_id)
    references public.feedback_links (business_id, booking_id, id)
    on delete restrict;

alter table public.email_events
  drop constraint email_events_subject_check,
  add constraint email_events_subject_check
    check (
      (
        booking_confirmation_id is not null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and (
          event_type = 'BOOKING_DELIVERED'::public.email_event_type
          or (
            event_type in (
              'BOOKING_CONFIRMED'::public.email_event_type,
              'BOOKING_CANCELLED'::public.email_event_type
            )
            and feedback_link_id is null
          )
        )
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is not null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and feedback_link_id is null
        and event_type in (
          'BOOKING_AMENDMENT_REQUESTED'::public.email_event_type,
          'BOOKING_AMENDMENT_CONFIRMED'::public.email_event_type
        )
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is not null
        and booking_change_id is null
        and confirmation_link_id is null
        and feedback_link_id is null
        and event_type = 'BOOKING_ADDON_REQUESTED'::public.email_event_type
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is not null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is null
        and feedback_link_id is null
        and event_type = 'BOOKING_ADDON_CONFIRMED'::public.email_event_type
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is not null
        and confirmation_link_id is not null
        and feedback_link_id is null
        and event_type = 'BOOKING_RESCHEDULED'::public.email_event_type
      )
      or (
        booking_confirmation_id is null
        and booking_amendment_id is null
        and booking_addon_id is null
        and booking_addon_confirmation_link_id is null
        and booking_change_id is null
        and confirmation_link_id is not null
        and feedback_link_id is null
        and event_type = 'BOOKING_CONFIRMATION_REQUESTED'::public.email_event_type
      )
    );

create unique index email_events_delivery_feedback_booking_unique
on public.email_events (business_id, booking_id)
where event_type = 'BOOKING_DELIVERED'::public.email_event_type
  and feedback_link_id is not null;

create index feedback_links_token_version_live_idx
on public.feedback_links (token_version, expires_at)
where used_at is null and revoked_at is null;

comment on column public.feedback_links.token_version is
  '0 = historical random token; 1 = HMAC key/version 1 deterministic capability.';
comment on column public.email_events.feedback_link_id is
  'Exact immutable feedback capability associated with a new BOOKING_DELIVERED event.';

create or replace function private.derive_feedback_capability_token(
  p_token_version smallint,
  p_business_id uuid,
  p_booking_id uuid,
  p_feedback_link_id uuid,
  p_purpose text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_secret text;
  v_message text;
  v_mac bytea;
begin
  if p_token_version <> 1
    or p_business_id is null
    or p_booking_id is null
    or p_feedback_link_id is null
    or p_purpose <> 'booking_feedback'
  then
    raise exception 'unsupported_feedback_capability_derivation'
      using errcode = '22023';
  end if;

  select secret.decrypted_secret
  into v_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'mykustomers_feedback_capability_hmac_v1';

  if not found or v_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'feedback_capability_key_unavailable'
      using errcode = '55000';
  end if;

  v_message := pg_catalog.format(
    'mykustomers.feedback-capability|version=%s|purpose=%s|business_id=%s|booking_id=%s|feedback_link_id=%s',
    p_token_version::text,
    p_purpose,
    p_business_id::text,
    p_booking_id::text,
    p_feedback_link_id::text
  );

  v_mac := extensions.hmac(v_message, v_secret, 'sha256');

  return pg_catalog.translate(
    pg_catalog.rtrim(pg_catalog.encode(v_mac, 'base64'), '='),
    '+/',
    '-_'
  );
end;
$function$;

alter function private.derive_feedback_capability_token(
  smallint, uuid, uuid, uuid, text
) owner to postgres;
revoke all on function private.derive_feedback_capability_token(
  smallint, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

create or replace function private.enforce_feedback_capability_v1_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
  v_expected_hash text;
begin
  if tg_op = 'UPDATE'
    and old.token_version = 1
    and (
      new.token_version is distinct from old.token_version
      or new.id is distinct from old.id
      or new.business_id is distinct from old.business_id
      or new.booking_id is distinct from old.booking_id
      or new.purpose is distinct from old.purpose
      or new.token_hash is distinct from old.token_hash
    )
  then
    raise exception 'feedback_capability_v1_identity_immutable'
      using errcode = '23000';
  end if;

  if new.token_version = 1 then
    v_token := private.derive_feedback_capability_token(
      1::smallint,
      new.business_id,
      new.booking_id,
      new.id,
      new.purpose
    );
    v_expected_hash := pg_catalog.encode(
      extensions.digest(v_token, 'sha256'),
      'hex'
    );

    if new.token_hash is distinct from v_expected_hash then
      raise exception 'feedback_capability_v1_hash_mismatch'
        using errcode = '23000';
    end if;
  end if;

  return new;
end;
$function$;

alter function private.enforce_feedback_capability_v1_integrity()
  owner to postgres;
revoke all on function private.enforce_feedback_capability_v1_integrity()
from public, anon, authenticated, service_role;

drop trigger if exists feedback_links_enforce_v1_integrity
on public.feedback_links;
create trigger feedback_links_enforce_v1_integrity
before insert or update of
  token_version, id, business_id, booking_id, purpose, token_hash
on public.feedback_links
for each row execute function private.enforce_feedback_capability_v1_integrity();

create or replace function private.revoke_open_feedback_links(
  target_booking_id uuid,
  reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  revoked_count integer;
begin
  if reason is null or char_length(reason) > 80 then
    raise exception 'invalid_feedback_revocation_reason'
      using errcode = '22023';
  end if;

  update public.feedback_links as feedback_link
  set revoked_at = coalesce(feedback_link.revoked_at, statement_timestamp()),
      revoked_reason = reason
  where feedback_link.booking_id = target_booking_id
    and feedback_link.used_at is null
    and feedback_link.revoked_at is null;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$function$;

alter function private.revoke_open_feedback_links(uuid, text) owner to postgres;
revoke all on function private.revoke_open_feedback_links(uuid, text)
from public, anon, authenticated, service_role;

create or replace function private.create_feedback_capability_v1(
  p_business_id uuid,
  p_booking_id uuid,
  p_created_by uuid
)
returns table (
  feedback_link_id uuid,
  feedback_token text,
  token_hash text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_feedback_link_id uuid := extensions.gen_random_uuid();
  v_feedback_token text;
  v_token_hash text;
  v_created_at timestamptz := statement_timestamp();
  v_expires_at timestamptz := v_created_at + interval '14 days';
begin
  if p_business_id is null or p_booking_id is null or p_created_by is null then
    raise exception 'invalid_feedback_capability_context'
      using errcode = '22023';
  end if;

  v_feedback_token := private.derive_feedback_capability_token(
    1::smallint,
    p_business_id,
    p_booking_id,
    v_feedback_link_id,
    'booking_feedback'
  );
  v_token_hash := pg_catalog.encode(
    extensions.digest(v_feedback_token, 'sha256'),
    'hex'
  );

  insert into public.feedback_links (
    id,
    business_id,
    booking_id,
    token_hash,
    token_version,
    purpose,
    expires_at,
    created_by,
    created_at
  )
  values (
    v_feedback_link_id,
    p_business_id,
    p_booking_id,
    v_token_hash,
    1,
    'booking_feedback',
    v_expires_at,
    p_created_by,
    v_created_at
  );

  return query
  select v_feedback_link_id, v_feedback_token, v_token_hash, v_expires_at;
end;
$function$;

alter function private.create_feedback_capability_v1(uuid, uuid, uuid)
  owner to postgres;
revoke all on function private.create_feedback_capability_v1(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function private.try_auto_complete_delivered_booking(
  p_business_id uuid,
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking public.bookings;
  v_totals record;
begin
  if p_source not in ('feedback_submission', 'payment_recording') then
    raise exception 'invalid_auto_completion_source'
      using errcode = '22023';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.business_id = p_business_id
    and booking.id = p_booking_id
  for update;

  if not found or v_booking.status <> 'DELIVERED' then
    return false;
  end if;

  if not exists (
    select 1
    from public.feedback as feedback
    where feedback.business_id = v_booking.business_id
      and feedback.booking_id = v_booking.id
  ) then
    return false;
  end if;

  select totals.*
  into v_totals
  from private.booking_payment_totals(
    v_booking.business_id,
    v_booking.id
  ) as totals;

  if not found or v_totals.outstanding_amount_minor <> 0 then
    return false;
  end if;

  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings as booking
  set status = 'COMPLETED'::public.booking_status
  where booking.business_id = v_booking.business_id
    and booking.id = v_booking.id
    and booking.status = 'DELIVERED'::public.booking_status;

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
    p_actor_user_id,
    v_booking.business_id,
    'BOOKING_COMPLETED'::public.audit_event_type,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'from_status', 'DELIVERED',
      'to_status', 'COMPLETED',
      'automatic', true,
      'source', p_source
    )
  );

  return true;
end;
$function$;

alter function private.try_auto_complete_delivered_booking(
  uuid, uuid, uuid, text
) owner to postgres;
revoke all on function private.try_auto_complete_delivered_booking(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

create or replace function private.customer_feedback_view(
  link_row public.feedback_links
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_booking public.bookings;
  v_business public.businesses;
begin
  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = link_row.booking_id
    and booking.business_id = link_row.business_id;

  if not found then
    return null;
  end if;

  select business.*
  into v_business
  from public.businesses as business
  where business.id = v_booking.business_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'business_name', v_business.name,
    'booking_reference', v_booking.reference,
    'booking_title', v_booking.title,
    'booking_status', v_booking.status,
    'delivered_at', v_booking.delivered_at,
    'completed_at', v_booking.completed_at,
    'expires_at', link_row.expires_at
  );
end;
$function$;

alter function private.customer_feedback_view(public.feedback_links)
  owner to postgres;
revoke all on function private.customer_feedback_view(public.feedback_links)
from public, anon, authenticated, service_role;

create or replace function private.enforce_feedback_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking public.bookings;
  v_link public.feedback_links;
  v_now timestamptz := statement_timestamp();
begin
  if tg_op = 'UPDATE' then
    raise exception 'feedback_immutable'
      using errcode = '23000';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = new.booking_id
    and booking.business_id = new.business_id;

  if not found
    or v_booking.customer_id is distinct from new.customer_id
    or v_booking.status not in (
      'DELIVERED'::public.booking_status,
      'COMPLETED'::public.booking_status
    )
  then
    raise exception 'feedback_requires_delivered_or_completed_booking'
      using errcode = '23000';
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.id = new.feedback_link_id
    and feedback_link.business_id = new.business_id
    and feedback_link.booking_id = new.booking_id;

  if not found then
    raise exception 'feedback_link_mismatch'
      using errcode = '23000';
  end if;

  if v_link.used_at is not null
    or v_link.revoked_at is not null
    or v_link.expires_at <= v_now
    or v_link.purpose <> 'booking_feedback'
  then
    raise exception 'feedback_link_not_usable'
      using errcode = '23000';
  end if;

  new.comment := nullif(trim(coalesce(new.comment, '')), '');
  new.submitted_at := v_now;
  new.created_at := v_now;
  return new;
end;
$function$;

alter function private.enforce_feedback_integrity() owner to postgres;
revoke all on function private.enforce_feedback_integrity()
from public, anon, authenticated, service_role;

create or replace function public.get_feedback_public_view(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_link public.feedback_links;
  v_booking_status public.booking_status;
  v_view_data jsonb;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.status
  into v_booking_status
  from public.bookings as booking
  where booking.id = v_link.booking_id
    and booking.business_id = v_link.business_id;

  if not found then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if v_link.used_at is not null then
    v_view_data := private.customer_feedback_view(v_link);
    return jsonb_build_object('status', 'submitted', 'booking', v_view_data);
  end if;

  if v_link.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if v_link.expires_at <= statement_timestamp() then
    return jsonb_build_object('status', 'expired');
  end if;

  if v_booking_status not in (
    'DELIVERED'::public.booking_status,
    'COMPLETED'::public.booking_status
  ) then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  v_view_data := private.customer_feedback_view(v_link);
  if v_view_data is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return jsonb_build_object('status', 'valid', 'booking', v_view_data);
end;
$function$;

alter function public.get_feedback_public_view(text) owner to postgres;
revoke all on function public.get_feedback_public_view(text)
from public, anon, authenticated, service_role;
grant execute on function public.get_feedback_public_view(text) to service_role;

create or replace function public.record_feedback_link_open(
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_link_id uuid;
  v_booking_id uuid;
  v_business_id uuid;
  v_opened_at timestamptz;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  update public.feedback_links as feedback_link
  set first_opened_at = statement_timestamp()
  from public.bookings as booking
  where feedback_link.token_hash = p_token_hash
    and feedback_link.purpose = 'booking_feedback'
    and feedback_link.first_opened_at is null
    and feedback_link.revoked_at is null
    and feedback_link.used_at is null
    and feedback_link.expires_at > statement_timestamp()
    and booking.id = feedback_link.booking_id
    and booking.business_id = feedback_link.business_id
    and booking.status in (
      'DELIVERED'::public.booking_status,
      'COMPLETED'::public.booking_status
    )
  returning
    feedback_link.id,
    feedback_link.booking_id,
    feedback_link.business_id,
    feedback_link.first_opened_at
  into v_link_id, v_booking_id, v_business_id, v_opened_at;

  if v_link_id is null then
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
    v_business_id,
    'FEEDBACK_OPENED'::public.audit_event_type,
    jsonb_build_object(
      'booking_id', v_booking_id,
      'feedback_link_id', v_link_id,
      'opened_at', v_opened_at
    )
  );

  return true;
end;
$function$;

alter function public.record_feedback_link_open(text) owner to postgres;
revoke all on function public.record_feedback_link_open(text)
from public, anon, authenticated, service_role;
grant execute on function public.record_feedback_link_open(text) to service_role;

create or replace function public.submit_feedback_by_token_hash(
  p_token_hash text,
  p_overall_rating integer,
  p_on_time boolean,
  p_met_expectations boolean,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_link public.feedback_links;
  v_locked_link public.feedback_links;
  v_booking public.bookings;
  v_feedback_id uuid;
  v_clean_comment text;
  v_submitted_at timestamptz := statement_timestamp();
  v_auto_completed boolean := false;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if p_overall_rating is null or p_overall_rating < 1 or p_overall_rating > 5
    or p_on_time is null or p_met_expectations is null
  then
    return jsonb_build_object('status', 'invalid_feedback');
  end if;

  v_clean_comment := nullif(trim(coalesce(p_comment, '')), '');
  if v_clean_comment is not null
    and (
      char_length(v_clean_comment) > 2000
      or v_clean_comment <> pg_catalog.regexp_replace(
        v_clean_comment,
        '<[^>]*>',
        '',
        'g'
      )
    )
  then
    return jsonb_build_object('status', 'invalid_feedback');
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = v_link.booking_id
    and booking.business_id = v_link.business_id
  for update;

  if not found or v_booking.status not in (
    'DELIVERED'::public.booking_status,
    'COMPLETED'::public.booking_status
  ) then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  select feedback_link.*
  into v_locked_link
  from public.feedback_links as feedback_link
  where feedback_link.id = v_link.id
    and feedback_link.token_hash = p_token_hash
    and feedback_link.business_id = v_booking.business_id
    and feedback_link.booking_id = v_booking.id
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_locked_link.used_at is not null then
    return jsonb_build_object('status', 'already_submitted');
  end if;
  if v_locked_link.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_locked_link.expires_at <= v_submitted_at then
    return jsonb_build_object('status', 'expired');
  end if;

  if exists (
    select 1
    from public.feedback as feedback
    where feedback.business_id = v_booking.business_id
      and feedback.booking_id = v_booking.id
  ) then
    update public.feedback_links as feedback_link
    set used_at = coalesce(feedback_link.used_at, v_submitted_at)
    where feedback_link.id = v_locked_link.id;
    return jsonb_build_object('status', 'already_submitted');
  end if;

  insert into public.feedback (
    business_id,
    booking_id,
    customer_id,
    feedback_link_id,
    overall_rating,
    on_time,
    met_expectations,
    comment,
    submitted_at,
    created_at
  )
  values (
    v_booking.business_id,
    v_booking.id,
    v_booking.customer_id,
    v_locked_link.id,
    p_overall_rating,
    p_on_time,
    p_met_expectations,
    v_clean_comment,
    v_submitted_at,
    v_submitted_at
  )
  returning id into v_feedback_id;

  update public.feedback_links as feedback_link
  set used_at = v_submitted_at
  where feedback_link.id = v_locked_link.id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    v_booking.business_id,
    'FEEDBACK_SUBMITTED'::public.audit_event_type,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'feedback_id', v_feedback_id,
      'feedback_link_id', v_locked_link.id,
      'overall_rating', p_overall_rating,
      'on_time', p_on_time,
      'met_expectations', p_met_expectations
    )
  );

  v_auto_completed := private.try_auto_complete_delivered_booking(
    v_booking.business_id,
    v_booking.id,
    null,
    'feedback_submission'
  );

  return jsonb_build_object(
    'status', 'submitted',
    'business_id', v_booking.business_id,
    'booking_id', v_booking.id,
    'feedback_id', v_feedback_id,
    'submitted_at', v_submitted_at,
    'booking_auto_completed', v_auto_completed
  );
end;
$function$;

alter function public.submit_feedback_by_token_hash(
  text, integer, boolean, boolean, text
) owner to postgres;
revoke all on function public.submit_feedback_by_token_hash(
  text, integer, boolean, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_feedback_by_token_hash(
  text, integer, boolean, boolean, text
) to service_role;

create or replace function public.record_booking_payment(
  p_booking_id uuid,
  p_amount_minor bigint,
  p_operation_id uuid
)
returns table (
  payment_id uuid,
  recorded_paid_amount_minor bigint,
  outstanding_amount_minor bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_existing_payment public.booking_payments;
  v_payment public.booking_payments;
  v_totals record;
begin
  if v_caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_operation_id is null then
    raise exception 'payment_operation_id_required' using errcode = '22023';
  end if;
  if p_amount_minor is null
    or p_amount_minor <= 0
    or p_amount_minor > 9007199254740991
  then
    raise exception 'payment_amount_invalid' using errcode = '22023';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(v_booking.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;

  select payment.*
  into v_existing_payment
  from public.booking_payments as payment
  where payment.business_id = v_booking.business_id
    and payment.booking_id = v_booking.id
    and payment.operation_id = p_operation_id;

  if v_existing_payment.id is not null then
    if v_existing_payment.amount_minor is distinct from p_amount_minor
      or v_existing_payment.recorded_by is distinct from v_caller_user_id
    then
      raise exception 'payment_operation_conflict' using errcode = '23000';
    end if;

    perform private.try_auto_complete_delivered_booking(
      v_booking.business_id,
      v_booking.id,
      v_caller_user_id,
      'payment_recording'
    );

    select totals.*
    into v_totals
    from private.booking_payment_totals(
      v_booking.business_id,
      v_booking.id
    ) as totals;

    return query
    select v_existing_payment.id,
      v_totals.recorded_paid_amount_minor,
      v_totals.outstanding_amount_minor;
    return;
  end if;

  if v_booking.status not in (
    'IN_PROGRESS'::public.booking_status,
    'READY'::public.booking_status,
    'DELIVERED'::public.booking_status
  ) then
    raise exception 'booking_not_eligible_for_payment_recording'
      using errcode = '23000';
  end if;

  select totals.*
  into v_totals
  from private.booking_payment_totals(
    v_booking.business_id,
    v_booking.id
  ) as totals;

  if v_totals.outstanding_amount_minor <= 0 then
    raise exception 'booking_balance_already_recorded' using errcode = '23514';
  end if;
  if p_amount_minor > v_totals.outstanding_amount_minor then
    raise exception 'payment_exceeds_outstanding_balance' using errcode = '23514';
  end if;

  insert into public.booking_payments (
    business_id,
    booking_id,
    operation_id,
    amount_minor,
    recorded_by
  )
  values (
    v_booking.business_id,
    v_booking.id,
    p_operation_id,
    p_amount_minor,
    v_caller_user_id
  )
  returning * into v_payment;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    v_caller_user_id,
    v_booking.business_id,
    'BOOKING_PAYMENT_RECORDED'::public.audit_event_type,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'payment_id', v_payment.id,
      'amount_minor', v_payment.amount_minor,
      'currency', v_booking.currency
    )
  );

  perform private.try_auto_complete_delivered_booking(
    v_booking.business_id,
    v_booking.id,
    v_caller_user_id,
    'payment_recording'
  );

  select totals.*
  into v_totals
  from private.booking_payment_totals(
    v_booking.business_id,
    v_booking.id
  ) as totals;

  return query
  select v_payment.id,
    v_totals.recorded_paid_amount_minor,
    v_totals.outstanding_amount_minor;
end;
$function$;

alter function public.record_booking_payment(uuid, bigint, uuid)
  owner to postgres;
revoke all on function public.record_booking_payment(uuid, bigint, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.record_booking_payment(uuid, bigint, uuid)
to authenticated;

create or replace function public.deliver_booking_with_feedback(
  p_booking_id uuid
)
returns table (
  booking_id uuid,
  booking_status public.booking_status,
  email_event_id uuid,
  feedback_link_id uuid,
  feedback_token text,
  expires_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_event public.email_events;
  v_link public.feedback_links;
  v_created record;
  v_transition record;
  v_token text;
  v_expected_hash text;
  v_replaced_count integer;
begin
  if v_caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(v_booking.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;

  if v_booking.status in (
    'DELIVERED'::public.booking_status,
    'COMPLETED'::public.booking_status
  ) then
    select event.*
    into v_event
    from public.email_events as event
    where event.business_id = v_booking.business_id
      and event.booking_id = v_booking.id
      and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
      and event.feedback_link_id is not null
    order by event.created_at desc, event.id desc
    limit 1;

    if not found then
      raise exception 'delivery_feedback_association_unavailable'
        using errcode = '55000';
    end if;

    select feedback_link.*
    into v_link
    from public.feedback_links as feedback_link
    where feedback_link.id = v_event.feedback_link_id
      and feedback_link.business_id = v_event.business_id
      and feedback_link.booking_id = v_event.booking_id;

    if not found then
      raise exception 'delivery_feedback_association_unavailable'
        using errcode = '55000';
    end if;
    if v_link.token_version <> 1 then
      raise exception 'delivery_feedback_legacy_token_not_reconstructable'
        using errcode = '55000';
    end if;
    if v_link.revoked_at is not null then
      raise exception 'delivery_feedback_capability_revoked'
        using errcode = '55000';
    end if;
    if v_link.expires_at <= statement_timestamp() then
      raise exception 'delivery_feedback_capability_expired'
        using errcode = '55000';
    end if;

    v_token := private.derive_feedback_capability_token(
      v_link.token_version,
      v_link.business_id,
      v_link.booking_id,
      v_link.id,
      v_link.purpose
    );
    v_expected_hash := pg_catalog.encode(
      extensions.digest(v_token, 'sha256'),
      'hex'
    );
    if v_expected_hash is distinct from v_link.token_hash then
      raise exception 'delivery_feedback_capability_integrity_failure'
        using errcode = '23000';
    end if;

    return query
    select v_booking.id, v_booking.status, v_event.id, v_link.id,
      v_token, v_link.expires_at, true;
    return;
  end if;

  if v_booking.status <> 'READY'::public.booking_status then
    raise exception 'booking_not_ready_for_delivery' using errcode = '23000';
  end if;

  if exists (
    select 1
    from public.feedback as feedback
    where feedback.business_id = v_booking.business_id
      and feedback.booking_id = v_booking.id
  ) then
    raise exception 'feedback_already_submitted_before_delivery'
      using errcode = '23000';
  end if;

  v_replaced_count := private.revoke_open_feedback_links(
    v_booking.id,
    'delivery_v1_replaced'
  );

  select created.*
  into v_created
  from private.create_feedback_capability_v1(
    v_booking.business_id,
    v_booking.id,
    v_caller_user_id
  ) as created;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    v_caller_user_id,
    v_booking.business_id,
    case
      when v_replaced_count > 0
        then 'FEEDBACK_LINK_REGENERATED'::public.audit_event_type
      else 'FEEDBACK_LINK_CREATED'::public.audit_event_type
    end,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'feedback_link_id', v_created.feedback_link_id,
      'expires_at', v_created.expires_at,
      'token_version', 1,
      'replaced_link_count', v_replaced_count,
      'source', 'delivery'
    )
  );

  select transition.*
  into v_transition
  from public.transition_booking_status(
    v_booking.id,
    'DELIVERED'::public.booking_status,
    null
  ) as transition;

  if v_transition.email_event_id is null then
    raise exception 'delivery_email_recipient_required'
      using errcode = '23514';
  end if;

  update public.email_events as event
  set feedback_link_id = v_created.feedback_link_id
  where event.id = v_transition.email_event_id
    and event.business_id = v_booking.business_id
    and event.booking_id = v_booking.id
    and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
    and event.feedback_link_id is null
  returning event.* into v_event;

  if not found then
    raise exception 'delivery_feedback_association_conflict'
      using errcode = '23000';
  end if;

  return query
  select v_booking.id, 'DELIVERED'::public.booking_status, v_event.id,
    v_created.feedback_link_id, v_created.feedback_token,
    v_created.expires_at, false;
end;
$function$;

alter function public.deliver_booking_with_feedback(uuid) owner to postgres;
revoke all on function public.deliver_booking_with_feedback(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.deliver_booking_with_feedback(uuid)
to authenticated;

create or replace function public.create_or_recover_booking_feedback_link(
  p_booking_id uuid
)
returns table (
  feedback_link_id uuid,
  feedback_token text,
  expires_at timestamptz,
  token_version smallint,
  replaced_link_count integer,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_link public.feedback_links;
  v_created record;
  v_token text;
  v_expected_hash text;
  v_replaced_count integer := 0;
  v_revoke_reason text;
begin
  if v_caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(v_booking.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;
  if v_booking.status not in (
    'DELIVERED'::public.booking_status,
    'COMPLETED'::public.booking_status
  ) then
    raise exception 'booking_not_eligible_for_feedback_link'
      using errcode = '23000';
  end if;
  if exists (
    select 1
    from public.feedback as feedback
    where feedback.business_id = v_booking.business_id
      and feedback.booking_id = v_booking.id
  ) then
    raise exception 'feedback_already_submitted' using errcode = '23000';
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.business_id = v_booking.business_id
    and feedback_link.booking_id = v_booking.id
    and feedback_link.used_at is null
    and feedback_link.revoked_at is null
  order by feedback_link.created_at desc, feedback_link.id desc
  limit 1
  for update;

  if found
    and v_link.expires_at > statement_timestamp()
    and v_link.token_version = 1
  then
    v_token := private.derive_feedback_capability_token(
      v_link.token_version,
      v_link.business_id,
      v_link.booking_id,
      v_link.id,
      v_link.purpose
    );
    v_expected_hash := pg_catalog.encode(
      extensions.digest(v_token, 'sha256'),
      'hex'
    );
    if v_expected_hash is distinct from v_link.token_hash then
      raise exception 'feedback_capability_integrity_failure'
        using errcode = '23000';
    end if;

    return query
    select v_link.id, v_token, v_link.expires_at, v_link.token_version,
      0, true;
    return;
  end if;

  if found and v_link.token_version = 0 then
    v_revoke_reason := 'legacy_v0_upgraded';
  elsif found and v_link.expires_at <= statement_timestamp() then
    v_revoke_reason := 'expired_reissued';
  elsif found then
    raise exception 'unsupported_feedback_capability_version'
      using errcode = '55000';
  else
    v_revoke_reason := 'manual_v1_replaced';
  end if;

  v_replaced_count := private.revoke_open_feedback_links(
    v_booking.id,
    v_revoke_reason
  );

  select created.*
  into v_created
  from private.create_feedback_capability_v1(
    v_booking.business_id,
    v_booking.id,
    v_caller_user_id
  ) as created;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    v_caller_user_id,
    v_booking.business_id,
    case
      when v_replaced_count > 0
        then 'FEEDBACK_LINK_REGENERATED'::public.audit_event_type
      else 'FEEDBACK_LINK_CREATED'::public.audit_event_type
    end,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'feedback_link_id', v_created.feedback_link_id,
      'expires_at', v_created.expires_at,
      'token_version', 1,
      'replaced_link_count', v_replaced_count,
      'source', 'manual_share'
    )
  );

  return query
  select v_created.feedback_link_id, v_created.feedback_token,
    v_created.expires_at, 1::smallint, v_replaced_count, false;
end;
$function$;

alter function public.create_or_recover_booking_feedback_link(uuid)
  owner to postgres;
revoke all on function public.create_or_recover_booking_feedback_link(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.create_or_recover_booking_feedback_link(uuid)
to authenticated;

create or replace function public.get_delivery_feedback_dispatch_context(
  p_email_event_id uuid
)
returns table (
  email_event_id uuid,
  business_id uuid,
  booking_id uuid,
  recipient_email text,
  feedback_link_id uuid,
  feedback_token text,
  expires_at timestamptz,
  booking_status public.booking_status
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.email_events;
  v_link public.feedback_links;
  v_booking public.bookings;
  v_token text;
  v_expected_hash text;
begin
  select event.*
  into v_event
  from public.email_events as event
  where event.id = p_email_event_id
    and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type;

  if not found then
    raise exception 'delivery_event_not_found' using errcode = '42501';
  end if;
  if v_event.status not in (
    'PENDING'::public.email_event_status,
    'SENDING'::public.email_event_status,
    'FAILED'::public.email_event_status
  ) then
    raise exception 'delivery_event_not_dispatchable' using errcode = '23000';
  end if;
  if v_event.created_at + interval '48 hours' <= statement_timestamp() then
    raise exception 'delivery_event_retry_horizon_elapsed'
      using errcode = '55000';
  end if;
  if v_event.feedback_link_id is null then
    raise exception 'delivery_feedback_association_unavailable'
      using errcode = '55000';
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.id = v_event.feedback_link_id
    and feedback_link.business_id = v_event.business_id
    and feedback_link.booking_id = v_event.booking_id;

  if not found or v_link.token_version <> 1 then
    raise exception 'delivery_feedback_capability_unavailable'
      using errcode = '55000';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = v_event.booking_id
    and booking.business_id = v_event.business_id;

  if not found or v_booking.status not in (
    'DELIVERED'::public.booking_status,
    'COMPLETED'::public.booking_status
  ) then
    raise exception 'delivery_booking_state_unavailable'
      using errcode = '55000';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'delivery_feedback_capability_revoked'
      using errcode = '55000';
  end if;
  if v_link.expires_at <= statement_timestamp() then
    raise exception 'delivery_feedback_capability_expired'
      using errcode = '55000';
  end if;

  v_token := private.derive_feedback_capability_token(
    v_link.token_version,
    v_link.business_id,
    v_link.booking_id,
    v_link.id,
    v_link.purpose
  );
  v_expected_hash := pg_catalog.encode(
    extensions.digest(v_token, 'sha256'),
    'hex'
  );
  if v_expected_hash is distinct from v_link.token_hash then
    raise exception 'delivery_feedback_capability_integrity_failure'
      using errcode = '23000';
  end if;

  return query
  select v_event.id, v_event.business_id, v_event.booking_id,
    v_event.recipient_email, v_link.id, v_token, v_link.expires_at,
    v_booking.status;
end;
$function$;

alter function public.get_delivery_feedback_dispatch_context(uuid)
  owner to postgres;
revoke all on function public.get_delivery_feedback_dispatch_context(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_delivery_feedback_dispatch_context(uuid)
to service_role;

create or replace function private.enforce_delivery_event_feedback_association()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.email_events;
  v_link public.feedback_links;
begin
  if tg_op = 'UPDATE'
    and old.feedback_link_id is not null
    and new.feedback_link_id is distinct from old.feedback_link_id
  then
    raise exception 'delivery_feedback_association_immutable'
      using errcode = '23000';
  end if;

  select event.*
  into v_event
  from public.email_events as event
  where event.id = new.id;

  if not found then
    return null;
  end if;

  if v_event.event_type <> 'BOOKING_DELIVERED'::public.email_event_type then
    if v_event.feedback_link_id is not null then
      raise exception 'feedback_link_only_allowed_for_delivery_event'
        using errcode = '23000';
    end if;
    return null;
  end if;

  if v_event.feedback_link_id is null then
    raise exception 'new_delivery_event_requires_feedback_capability'
      using errcode = '23514';
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.id = v_event.feedback_link_id
    and feedback_link.business_id = v_event.business_id
    and feedback_link.booking_id = v_event.booking_id;

  if not found
    or v_link.token_version <> 1
    or v_link.purpose <> 'booking_feedback'
  then
    raise exception 'delivery_event_feedback_capability_invalid'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

alter function private.enforce_delivery_event_feedback_association()
  owner to postgres;
revoke all on function private.enforce_delivery_event_feedback_association()
from public, anon, authenticated, service_role;

create or replace function private.enforce_new_delivery_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.email_events as event
    join public.feedback_links as feedback_link
      on feedback_link.id = event.feedback_link_id
      and feedback_link.business_id = event.business_id
      and feedback_link.booking_id = event.booking_id
    where event.business_id = new.business_id
      and event.booking_id = new.id
      and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
      and feedback_link.token_version = 1
      and feedback_link.purpose = 'booking_feedback'
  ) then
    raise exception 'delivery_transition_requires_feedback_event_association'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

alter function private.enforce_new_delivery_transaction() owner to postgres;
revoke all on function private.enforce_new_delivery_transaction()
from public, anon, authenticated, service_role;

drop trigger if exists email_events_require_delivery_feedback_capability
on public.email_events;
create constraint trigger email_events_require_delivery_feedback_capability
after insert or update of
  event_type, business_id, booking_id, feedback_link_id
on public.email_events
deferrable initially deferred
for each row
execute function private.enforce_delivery_event_feedback_association();

drop trigger if exists bookings_require_delivery_feedback_transaction
on public.bookings;
create constraint trigger bookings_require_delivery_feedback_transaction
after update of status on public.bookings
deferrable initially deferred
for each row
when (
  old.status is distinct from new.status
  and new.status = 'DELIVERED'::public.booking_status
)
execute function private.enforce_new_delivery_transaction();

-- Retire the legacy authenticated hash-supplying creation boundary. The function
-- remains present only so historical application deployments fail by privilege,
-- rather than silently creating a forged or unreconstructable version-1 row.
revoke all on function public.create_booking_feedback_link(
  uuid, text, timestamptz
) from public, anon, authenticated, service_role;

-- Reassert trigger installation after replacing the integrity function.
drop trigger if exists feedback_enforce_integrity on public.feedback;
create trigger feedback_enforce_integrity
before insert or update on public.feedback
for each row execute function private.enforce_feedback_integrity();

notify pgrst, 'reload schema';

commit;
