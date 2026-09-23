-- Phase 2: additive provider-neutral channel. No historical backfill or scheduler change.
begin;

create table private.whatsapp_pilot_businesses (
  business_id uuid primary key references public.businesses(id),
  enabled boolean not null default false
);
alter table private.whatsapp_pilot_businesses enable row level security;
revoke all on private.whatsapp_pilot_businesses from public, anon, authenticated, service_role;

create table public.booking_communication_preferences (
  booking_id uuid primary key,
  business_id uuid not null,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  recipient_e164 text,
  consent_at timestamptz,
  consent_source text check (consent_source = 'VENDOR_CONFIRMED'),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, booking_id) references public.bookings(business_id, id),
  check (recipient_e164 is null or recipient_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  check (not whatsapp_enabled or (recipient_e164 is not null and consent_at is not null and consent_source = 'VENDOR_CONFIRMED' and disabled_at is null)),
  check (email_enabled or whatsapp_enabled or disabled_at is not null)
);
alter table public.booking_communication_preferences enable row level security;
revoke all on public.booking_communication_preferences from public, anon, authenticated, service_role;
grant select on public.booking_communication_preferences to authenticated;
create policy booking_communication_preferences_member_read on public.booking_communication_preferences
  for select to authenticated using ((select private.is_business_member(business_id)));

create table public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  booking_id uuid not null,
  event_type text not null check (event_type in ('BOOKING_CONFIRMATION_REQUESTED','BOOKING_CONFIRMED','BOOKING_RESCHEDULED','BOOKING_CANCELLED','BOOKING_DELIVERED','BOOKING_AMENDMENT_REQUESTED','BOOKING_AMENDMENT_CONFIRMED','BOOKING_ADDON_REQUESTED','BOOKING_ADDON_CONFIRMED')),
  source_id uuid not null,
  capability_id uuid,
  contact_hash text,
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  recipient_e164 text not null check (recipient_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','ACCEPTED','DELIVERED','READ','FAILED','UNKNOWN','CANCELLED')),
  provider text not null default 'wa_akg' check (provider = 'wa_akg'),
  provider_message_id text check (provider_message_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  error_code text check (error_code ~ '^[a-z_]{1,80}$'),
  accepted_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, booking_id, event_type, source_id),
  foreign key (business_id, booking_id) references public.bookings(business_id, id)
);
alter table public.whatsapp_events enable row level security;
revoke all on public.whatsapp_events from public, anon, authenticated, service_role;
-- Vendors see only delivery presentation, never phone, provider ID, lease or capability.
grant select (id,business_id,booking_id,event_type,status,created_at,updated_at) on public.whatsapp_events to authenticated;
create policy whatsapp_events_member_read on public.whatsapp_events
  for select to authenticated using ((select private.is_business_member(business_id)));
create index whatsapp_events_booking on public.whatsapp_events (business_id,booking_id,created_at desc);
create index whatsapp_events_pending on public.whatsapp_events (next_attempt_at,id) where status='PENDING';
create index whatsapp_events_processing on public.whatsapp_events (lease_expires_at) where status='PROCESSING';

create table private.whatsapp_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.whatsapp_events(id),
  attempt_number integer not null check (attempt_number between 1 and 3),
  lease_id uuid not null unique,
  status text not null check (status in ('PROCESSING','ACCEPTED','FAILED','UNKNOWN','CANCELLED')),
  error_code text check (error_code ~ '^[a-z_]{1,80}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(event_id,attempt_number)
);
alter table private.whatsapp_attempts enable row level security;
revoke all on private.whatsapp_attempts from public, anon, authenticated, service_role;

create table private.whatsapp_capabilities (
  event_id uuid primary key references public.whatsapp_events(id),
  path_prefix text not null check (path_prefix in ('c','a','x','f')),
  ciphertext bytea not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
alter table private.whatsapp_capabilities enable row level security;
revoke all on private.whatsapp_capabilities from public, anon, authenticated, service_role;

-- Fail closed when a key has not been provisioned; no key is exposed to the app.
create function private.whatsapp_capability_key() returns text
language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
  select s.decrypted_secret into strict k from vault.decrypted_secrets s
    where s.name='mykustomers_whatsapp_capabilities_v1';
  if k !~ '^[a-f0-9]{64}$' then raise exception 'whatsapp_key_unavailable'; end if;
  return k;
end $$;

-- This is the shared fanout point replacing only existing INSERT email statements.
-- Non-opted-in bookings execute the same email insert with the same associations.
create function private.enqueue_booking_communication(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.email_events; pref public.booking_communication_preferences; email_id uuid; source uuid;
begin
  e := jsonb_populate_record(null::public.email_events,p_data);
  select * into pref from public.booking_communication_preferences where booking_id=e.booking_id and business_id=e.business_id;
  if coalesce(pref.email_enabled,true) then
    -- Preserve the original email conflict targets and failure behavior.
    if e.event_type='BOOKING_ADDON_CONFIRMED' then
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.event_type,e.recipient_email)
    on conflict (booking_addon_id,event_type) where event_type='BOOKING_ADDON_CONFIRMED' do nothing returning id into email_id;
    elsif e.event_type='BOOKING_AMENDMENT_CONFIRMED' then
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.event_type,e.recipient_email)
    on conflict (booking_amendment_id,event_type) do nothing returning id into email_id;
    elsif e.event_type in ('BOOKING_CANCELLED','BOOKING_DELIVERED') then
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.event_type,e.recipient_email)
    on conflict (booking_confirmation_id,event_type) do nothing returning id into email_id;
    else
    insert into public.email_events(business_id,booking_id,customer_id,booking_confirmation_id,confirmation_link_id,booking_amendment_id,booking_addon_id,booking_addon_confirmation_link_id,booking_change_id,event_type,recipient_email)
    values(e.business_id,e.booking_id,e.customer_id,e.booking_confirmation_id,e.confirmation_link_id,e.booking_amendment_id,e.booking_addon_id,e.booking_addon_confirmation_link_id,e.booking_change_id,e.event_type,e.recipient_email)
    returning id into email_id;
    end if;
  end if;
  if pref.whatsapp_enabled and pref.disabled_at is null and exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=e.business_id and p.enabled) then
    source := coalesce(e.booking_change_id,e.booking_addon_confirmation_link_id,e.booking_amendment_id,e.confirmation_link_id,e.booking_addon_id,e.booking_confirmation_id);
    if source is null then raise exception 'whatsapp_event_source_missing'; end if;
    insert into public.whatsapp_events(business_id,booking_id,event_type,source_id,capability_id,contact_hash,idempotency_key,recipient_e164)
    values(e.business_id,e.booking_id,e.event_type::text,source,coalesce(e.confirmation_link_id,e.booking_addon_confirmation_link_id,e.booking_amendment_id),encode(extensions.digest(e.recipient_email,'sha256'),'hex'),
      encode(extensions.digest(concat_ws('|','whatsapp-v1',e.business_id,e.booking_id,e.event_type,source),'sha256'),'hex'),pref.recipient_e164)
    on conflict(business_id,booking_id,event_type,source_id) do nothing;
  end if;
  return email_id;
end $$;

-- Resolve the exact source; never select a newer capability for an older intent.
create function private.whatsapp_link_context(p_event public.whatsapp_events)
returns table(path_prefix text,token_hash text,expires_at timestamptz,valid boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_event.event_type in ('BOOKING_CONFIRMATION_REQUESTED','BOOKING_RESCHEDULED') then
    return query select 'c'::text,l.token_hash,l.expires_at,l.revoked_at is null and l.used_at is null
      from public.confirmation_links l where l.business_id=p_event.business_id and l.booking_id=p_event.booking_id
      and l.id=p_event.capability_id;
  elsif p_event.event_type='BOOKING_AMENDMENT_REQUESTED' then
    return query select 'a'::text,a.token_hash,a.expires_at,a.status='PENDING_CUSTOMER'
      from public.booking_amendments a where a.business_id=p_event.business_id and a.booking_id=p_event.booking_id and a.id=p_event.capability_id;
  elsif p_event.event_type='BOOKING_ADDON_REQUESTED' then
    return query select 'x'::text,l.token_hash,l.expires_at,l.revoked_at is null and l.used_at is null
      from public.booking_addon_confirmation_links l where l.business_id=p_event.business_id and l.booking_id=p_event.booking_id and l.id=p_event.capability_id;
  end if;
end $$;

create function private.capture_whatsapp_capability(p_booking_id uuid,p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.whatsapp_events; c record; h text;
begin
  if p_token !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'invalid_capability'; end if;
  h:=encode(extensions.digest(p_token,'sha256'),'hex');
  for e in select * from public.whatsapp_events where booking_id=p_booking_id and status='PENDING' and created_at>=transaction_timestamp() loop
    for c in select * from private.whatsapp_link_context(e) where token_hash=h and valid loop
      insert into private.whatsapp_capabilities(event_id,path_prefix,ciphertext,token_hash,expires_at)
      values(e.id,c.path_prefix,extensions.pgp_sym_encrypt(p_token,private.whatsapp_capability_key(),'cipher-algo=aes256,compress-algo=0'),h,c.expires_at)
      on conflict(event_id) do nothing;
    end loop;
  end loop;
end $$;

create function public.disable_booking_whatsapp(p_booking_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare b uuid;
begin
  select business_id into b from public.bookings where id=p_booking_id for update;
  if not private.is_business_member(b) then raise exception 'unauthorized' using errcode='42501'; end if;
  update public.booking_communication_preferences set whatsapp_enabled=false,disabled_at=now(),updated_at=now() where booking_id=p_booking_id and business_id=b;
  update public.whatsapp_events set status='CANCELLED',updated_at=now(),error_code='booking_updates_disabled' where booking_id=p_booking_id and status='PENDING';
  return found;
end $$;

create function public.claim_whatsapp_event(p_business_ids uuid[]) returns setof public.whatsapp_events
language plpgsql security definer set search_path='' as $$
declare e public.whatsapp_events;
begin
  -- A lease expiry is ambiguous: terminate it, never re-send it.
  with stale as (select id from public.whatsapp_events where status='PROCESSING' and lease_expires_at<now() order by lease_expires_at limit 100 for update skip locked), expired as (
    update public.whatsapp_events set status='UNKNOWN',error_code='lease_expired',updated_at=now()
    where id in (select id from stale) returning id,lease_id
  ) update private.whatsapp_attempts a set status='UNKNOWN',error_code='lease_expired',finished_at=now()
    from expired x where a.event_id=x.id and a.lease_id=x.lease_id and a.status='PROCESSING';
  with stopped as (select q.id from public.whatsapp_events q join public.booking_communication_preferences p on p.booking_id=q.booking_id where q.status='PENDING' and not p.whatsapp_enabled order by q.id limit 100 for update of q skip locked)
  update public.whatsapp_events set status='CANCELLED',error_code='booking_updates_disabled',updated_at=now() where id in (select id from stopped);
  select q.* into e from public.whatsapp_events q
    join public.booking_communication_preferences p on p.booking_id=q.booking_id and p.business_id=q.business_id
    join private.whatsapp_pilot_businesses pilot on pilot.business_id=q.business_id and pilot.enabled
    where q.status='PENDING' and q.next_attempt_at <= now() and q.attempt_count<3
      and q.business_id=any(p_business_ids) and p.whatsapp_enabled and p.disabled_at is null
    order by q.next_attempt_at,q.id limit 1 for update of q skip locked;
  if not found then return; end if;
  update public.whatsapp_events set status='PROCESSING',attempt_count=attempt_count+1,lease_id=gen_random_uuid(),lease_expires_at=now()+interval '45 seconds',updated_at=now()
    where id=e.id returning * into e;
  insert into private.whatsapp_attempts(event_id,attempt_number,lease_id,status) values(e.id,e.attempt_count,e.lease_id,'PROCESSING');
  return next e;
end $$;

create function public.finish_whatsapp_event(p_event_id uuid,p_lease_id uuid,p_status text,p_error_code text default null,p_provider_message_id text default null,p_retryable boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare e public.whatsapp_events; retry boolean;
begin
  if p_status not in ('ACCEPTED','FAILED','UNKNOWN','CANCELLED') or (p_status='ACCEPTED' and p_provider_message_id is null) then raise exception 'invalid_result'; end if;
  select * into e from public.whatsapp_events where id=p_event_id and lease_id=p_lease_id and status='PROCESSING' for update;
  if not found then return false; end if;
  retry:=p_status='FAILED' and p_retryable and e.attempt_count<3 and p_error_code in ('gateway_rate_limited','session_disconnected');
  update private.whatsapp_attempts set status=p_status,error_code=p_error_code,finished_at=now()
    where event_id=e.id and lease_id=p_lease_id and status='PROCESSING';
  update public.whatsapp_events set status=case when retry then 'PENDING' else p_status end,
    error_code=p_error_code,provider_message_id=p_provider_message_id,
    accepted_at=case when p_status='ACCEPTED' then now() else null end,
    next_attempt_at=case when retry then now()+make_interval(secs=>60*power(2,e.attempt_count-1)::int) else next_attempt_at end,
    lease_id=null,lease_expires_at=null,updated_at=now() where id=e.id;
  return true;
end $$;

create function public.get_whatsapp_dispatch_context(p_event_id uuid,p_lease_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.whatsapp_events; b public.bookings; business_name text; c private.whatsapp_capabilities; link record; token text;
begin
  select * into e from public.whatsapp_events where id=p_event_id and lease_id=p_lease_id and status='PROCESSING' and lease_expires_at>now();
  if not found then return null; end if;
  if not exists(select 1 from public.booking_communication_preferences p where p.booking_id=e.booking_id and p.whatsapp_enabled and p.disabled_at is null)
    or not exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=e.business_id and p.enabled) then return null; end if;
  select * into strict b from public.bookings where id=e.booking_id and business_id=e.business_id;
  select name into strict business_name from public.businesses where id=e.business_id;
  select * into c from private.whatsapp_capabilities where event_id=e.id;
  if e.event_type in ('BOOKING_CONFIRMATION_REQUESTED','BOOKING_RESCHEDULED','BOOKING_AMENDMENT_REQUESTED','BOOKING_ADDON_REQUESTED','BOOKING_DELIVERED') then
    if c.event_id is null or c.expires_at<=now() or e.created_at<now()-interval '48 hours' then return null; end if;
    if e.event_type<>'BOOKING_DELIVERED' and not exists(select 1 from private.whatsapp_link_context(e) l where l.token_hash=c.token_hash and l.valid and l.expires_at>now()) then return null; end if;
    if e.event_type='BOOKING_DELIVERED' and not exists(select 1 from public.feedback_links f where f.business_id=e.business_id and f.booking_id=e.booking_id and f.token_hash=c.token_hash and f.revoked_at is null and f.used_at is null and f.expires_at>now()) then return null; end if;
    token:=extensions.pgp_sym_decrypt(c.ciphertext,private.whatsapp_capability_key());
    if encode(extensions.digest(token,'sha256'),'hex')<>c.token_hash then raise exception 'capability_integrity'; end if;
  end if;
  return jsonb_build_object('event_type',e.event_type,'business_name',business_name,'booking_reference',b.reference,'recipient',e.recipient_e164,'path_prefix',c.path_prefix,'token',token);
end $$;

-- Existing domain transactions: only their email INSERT fanout changes.
CREATE OR REPLACE FUNCTION public.confirm_booking_addon_by_token_hash(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', addon_row.business_id,
      'booking_id', addon_row.booking_id,
      'customer_id', booking_row.customer_id,
      'booking_addon_id', addon_row.id,
      'event_type', 'BOOKING_ADDON_CONFIRMED',
      'recipient_email', addon_row.confirmation_contact_email
    ));

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
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_booking_amendment_by_token_hash(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  amendment_row public.booking_amendments;
  booking_row public.bookings;
  confirmed_time timestamptz := now();
  created_email_event_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select amendment.*
  into amendment_row
  from public.booking_amendments as amendment
  where amendment.token_hash = p_token_hash
  for update;

  if not found or amendment_row.purpose <> 'booking_amendment_confirmation' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if amendment_row.status = 'CONFIRMED' then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'business_id', amendment_row.business_id,
      'booking_id', amendment_row.booking_id,
      'amendment_id', amendment_row.id
    );
  end if;

  if amendment_row.status = 'REVOKED' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if amendment_row.expires_at <= confirmed_time then
    return jsonb_build_object('status', 'expired');
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = amendment_row.booking_id
    and booking.business_id = amendment_row.business_id
  for update;

  if not found or booking_row.status not in ('CONFIRMED', 'IN_PROGRESS') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if booking_row.confirmation_terms_hash is distinct from amendment_row.base_terms_hash then
    return jsonb_build_object('status', 'stale');
  end if;

  perform set_config('app.booking_amendment_allowed', 'true', true);

  update public.bookings as booking
  set title = amendment_row.proposed_terms ->> 'title',
      description = amendment_row.proposed_terms ->> 'description',
      currency = (amendment_row.proposed_terms ->> 'currency')::public.booking_currency,
      total_amount_minor = (amendment_row.proposed_terms ->> 'total_amount_minor')::bigint,
      deposit_amount_minor = (amendment_row.proposed_terms ->> 'deposit_amount_minor')::bigint,
      scheduled_for = (amendment_row.proposed_terms ->> 'scheduled_for')::timestamptz,
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = amendment_row.proposed_terms_hash,
      confirmation_terms_snapshot = amendment_row.proposed_terms
  where booking.id = booking_row.id;

  update public.booking_amendments as amendment
  set status = 'CONFIRMED',
      confirmed_at = confirmed_time,
      effective_terms = amendment_row.proposed_terms,
      effective_terms_hash = amendment_row.proposed_terms_hash
  where amendment.id = amendment_row.id;

  insert into public.booking_changes (
    business_id,
    booking_id,
    changed_by,
    change_type,
    amendment_id,
    previous_scheduled_for,
    new_scheduled_for,
    old_terms,
    new_terms,
    changed_fields
  )
  values (
    amendment_row.business_id,
    amendment_row.booking_id,
    null,
    'amendment',
    amendment_row.id,
    (amendment_row.old_terms ->> 'scheduled_for')::timestamptz,
    (amendment_row.proposed_terms ->> 'scheduled_for')::timestamptz,
    amendment_row.old_terms,
    amendment_row.proposed_terms,
    amendment_row.changed_fields
  );

  created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', amendment_row.business_id,
      'booking_id', amendment_row.booking_id,
      'customer_id', booking_row.customer_id,
      'booking_amendment_id', amendment_row.id,
      'event_type', 'BOOKING_AMENDMENT_CONFIRMED',
      'recipient_email', amendment_row.contact_email
    ));

  if created_email_event_id is null then
    select event.id
    into created_email_event_id
    from public.email_events as event
    where event.booking_amendment_id = amendment_row.id
      and event.event_type = 'BOOKING_AMENDMENT_CONFIRMED';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    amendment_row.business_id,
    'BOOKING_AMENDMENT_CONFIRMED',
    jsonb_build_object(
      'booking_id', amendment_row.booking_id,
      'amendment_id', amendment_row.id,
      'base_terms_hash', amendment_row.base_terms_hash,
      'effective_terms_hash', amendment_row.proposed_terms_hash,
      'changed_fields', to_jsonb(amendment_row.changed_fields),
      'email_event_id', created_email_event_id
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', amendment_row.business_id,
    'booking_id', amendment_row.booking_id,
    'amendment_id', amendment_row.id,
    'confirmed_at', confirmed_time,
    'effective_terms_hash', amendment_row.proposed_terms_hash,
    'email_event_id', created_email_event_id
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_booking_by_token_hash(p_token_hash text, p_contact_email text, p_contact_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  link_row public.confirmation_links;
  booking_row public.bookings;
  customer_row public.customers;
  business_row public.businesses;
  snapshot jsonb;
  terms_hash text;
  normalized_contact_email text := private.normalize_customer_contact_email(p_contact_email);
  normalized_contact_phone text := nullif(trim(p_contact_phone), '');
  confirmation_id uuid;
  email_event_id uuid;
  confirmed_time timestamptz := clock_timestamp();
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

  select link.*
  into link_row
  from public.confirmation_links as link
  where link.token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = link_row.booking_id
    and booking.business_id = link_row.business_id
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

  select customer.*
  into customer_row
  from public.customers as customer
  where customer.id = booking_row.customer_id
    and customer.business_id = booking_row.business_id
  for update;

  select business.*
  into business_row
  from public.businesses as business
  where business.id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);
  terms_hash := private.booking_terms_hash(snapshot);

  -- Confirmation contact is booking-scoped evidence. Never enrich profile email.
  if normalized_contact_phone is not null
    and nullif(trim(customer_row.phone), '') is null
  then
    update public.customers as customer
    set phone = normalized_contact_phone
    where customer.id = customer_row.id
      and nullif(trim(customer.phone), '') is null;
  end if;

  update public.bookings as booking
  set status = 'CONFIRMED',
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = terms_hash,
      confirmation_terms_snapshot = snapshot
  where booking.id = booking_row.id;

  update public.confirmation_links as link
  set used_at = confirmed_time
  where link.id = link_row.id;

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

  email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_confirmation_id', confirmation_id,
      'event_type', 'BOOKING_CONFIRMED',
      'recipient_email', normalized_contact_email
    ));

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
      'phone_provided', normalized_contact_phone is not null,
      'operational_status', 'IN_PROGRESS'
    )
  );

  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings as booking
  set status = 'IN_PROGRESS'
  where booking.id = booking_row.id
    and booking.status = 'CONFIRMED';

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    booking_row.business_id,
    'BOOKING_STATUS_CHANGED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'from_status', 'CONFIRMED',
      'to_status', 'IN_PROGRESS',
      'automatic_after_confirmation', true
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'confirmed_at', confirmed_time,
    'terms_hash', terms_hash,
    'email_event_id', email_event_id,
    'operational_status', 'IN_PROGRESS'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_amendment(p_booking_id uuid, p_reason text, p_title text, p_description text, p_currency public.booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(amendment_id uuid, expires_at timestamp with time zone, replaced_amendment_count integer, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  confirmation_row public.booking_confirmations;
  customer_email text;
  clean_reason text := nullif(trim(coalesce(p_reason, '')), '');
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
  clean_description text := nullif(trim(coalesce(p_description, '')), '');
  old_snapshot jsonb;
  proposed_snapshot jsonb;
  proposed_hash text;
  changed text[] := array[]::text[];
  created_amendment_id uuid;
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
    raise exception 'amendment_expiration_invalid' using errcode = '22023';
  end if;
  if clean_reason is null or char_length(clean_reason) > 500 then
    raise exception 'amendment_reason_required' using errcode = '22023';
  end if;
  if clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>' then
    raise exception 'amendment_reason_must_be_plain_text' using errcode = '22023';
  end if;
  if clean_title is null or char_length(clean_title) > 160 then
    raise exception 'amendment_title_invalid' using errcode = '22023';
  end if;
  if clean_description is not null and char_length(clean_description) > 5000 then
    raise exception 'amendment_description_too_long' using errcode = '22023';
  end if;
  if p_total_amount_minor < 0
    or p_deposit_amount_minor < 0
    or p_deposit_amount_minor > p_total_amount_minor
  then
    raise exception 'amendment_amounts_invalid' using errcode = '22023';
  end if;
  if p_scheduled_for is not null and p_scheduled_for <= now() then
    raise exception 'amendment_schedule_must_be_future' using errcode = '22023';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;
  if booking_row.status not in ('CONFIRMED', 'IN_PROGRESS')
    or booking_row.confirmation_terms_hash is null
    or booking_row.confirmation_terms_snapshot is null
  then
    raise exception 'booking_not_eligible_for_amendment' using errcode = '23000';
  end if;

  old_snapshot := booking_row.confirmation_terms_snapshot;
  if booking_row.title is distinct from clean_title then
    changed := array_append(changed, 'title');
  end if;
  if booking_row.description is distinct from clean_description then
    changed := array_append(changed, 'description');
  end if;
  if booking_row.currency is distinct from p_currency then
    changed := array_append(changed, 'currency');
  end if;
  if booking_row.total_amount_minor is distinct from p_total_amount_minor then
    changed := array_append(changed, 'total_amount_minor');
  end if;
  if booking_row.deposit_amount_minor is distinct from p_deposit_amount_minor then
    changed := array_append(changed, 'deposit_amount_minor');
  end if;
  if booking_row.scheduled_for is distinct from p_scheduled_for then
    changed := array_append(changed, 'scheduled_for');
  end if;
  if cardinality(changed) = 0 then
    raise exception 'amendment_has_no_changes' using errcode = '22023';
  end if;

  proposed_snapshot := old_snapshot || jsonb_build_object(
    'title', clean_title,
    'description', clean_description,
    'currency', p_currency,
    'total_amount_minor', p_total_amount_minor,
    'deposit_amount_minor', p_deposit_amount_minor,
    'balance_amount_minor', p_total_amount_minor - p_deposit_amount_minor,
    'scheduled_for', p_scheduled_for
  );
  proposed_hash := private.booking_terms_hash(proposed_snapshot);

  select confirmation.*
  into confirmation_row
  from public.booking_confirmations as confirmation
  where confirmation.business_id = booking_row.business_id
    and confirmation.booking_id = booking_row.id
  order by confirmation.confirmed_at desc, confirmation.id desc
  limit 1;

  customer_email := private.normalize_customer_contact_email(
    confirmation_row.contact_email
  );
  if customer_email is null then
    raise exception 'amendment_contact_unavailable' using errcode = '23000';
  end if;

  replaced_count := private.revoke_pending_booking_amendments(
    booking_row.id,
    'replaced',
    caller_user_id
  );

  insert into public.booking_amendments (
    business_id, booking_id, token_hash, expires_at, reason,
    base_terms_hash, old_terms, proposed_terms, proposed_terms_hash,
    changed_fields, contact_email, contact_phone, proposed_by
  )
  values (
    booking_row.business_id, booking_row.id, p_token_hash, p_expires_at,
    clean_reason, booking_row.confirmation_terms_hash, old_snapshot,
    proposed_snapshot, proposed_hash, changed, customer_email,
    confirmation_row.contact_phone, caller_user_id
  )
  returning id into created_amendment_id;

  created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_amendment_id', created_amendment_id,
      'event_type', 'BOOKING_AMENDMENT_REQUESTED',
      'recipient_email', customer_email
    ));

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    caller_user_id,
    booking_row.business_id,
    'BOOKING_AMENDMENT_SUBMITTED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'amendment_id', created_amendment_id,
      'changed_fields', to_jsonb(changed),
      'base_terms_hash', booking_row.confirmation_terms_hash,
      'proposed_terms_hash', proposed_hash,
      'expires_at', p_expires_at,
      'replaced_amendment_count', replaced_count,
      'email_event_id', created_email_event_id
    )
  );

  return query
  select created_amendment_id, p_expires_at, replaced_count, created_email_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_confirmation_request(p_booking_id uuid, p_contact_email text, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(confirmation_link_id uuid, email_event_id uuid, recipient_email text, expires_at timestamp with time zone, replaced_link_count integer, request_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  latest_request public.email_events;
  latest_whatsapp public.whatsapp_events;
  normalized_contact_email text := private.normalize_customer_contact_email(p_contact_email);
  revoked_count integer;
  inserted_link_id uuid;
  inserted_event_id uuid;
  existing_link_expires_at timestamptz;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if normalized_contact_email is null
    or char_length(normalized_contact_email) > 254
    or normalized_contact_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'invalid_contact_email'
      using errcode = '22023';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'confirmation_link_expiration_invalid'
      using errcode = '22023';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status not in ('DRAFT', 'AWAITING_CUSTOMER') then
    raise exception 'booking_not_eligible_for_confirmation_request'
      using errcode = '23000';
  end if;

  select e.* into latest_whatsapp from public.whatsapp_events e
    where e.booking_id=booking_row.id and e.event_type='BOOKING_CONFIRMATION_REQUESTED'
      and e.contact_hash=encode(extensions.digest(normalized_contact_email,'sha256'),'hex')
      and e.created_at>now()-interval '30 seconds' and e.status<>'CANCELLED'
    order by e.created_at desc limit 1;
  if found then
    select l.expires_at into existing_link_expires_at from public.confirmation_links l where l.id=latest_whatsapp.capability_id;
    return query select latest_whatsapp.capability_id, null::uuid, normalized_contact_email,existing_link_expires_at,0,'duplicate_ignored'::text;
    return;
  end if;

  select event.*
  into latest_request
  from public.email_events as event
  where event.business_id = booking_row.business_id
    and event.booking_id = booking_row.id
    and event.event_type = 'BOOKING_CONFIRMATION_REQUESTED'
  order by event.created_at desc, event.id desc
  limit 1;

  if latest_request.id is not null
    and latest_request.recipient_email = normalized_contact_email
    and latest_request.status in ('PENDING', 'SENDING', 'SENT')
    and latest_request.created_at > now() - interval '30 seconds'
  then
    select link.expires_at
    into existing_link_expires_at
    from public.confirmation_links as link
    where link.id = latest_request.confirmation_link_id;

    return query
      select
        latest_request.confirmation_link_id,
        latest_request.id,
        latest_request.recipient_email,
        existing_link_expires_at,
        0,
        'duplicate_ignored'::text;
    return;
  end if;

  revoked_count := private.revoke_open_confirmation_links(
    booking_row.id,
    'confirmation_request_replaced'
  );

  if booking_row.status = 'DRAFT' then
    perform set_config('app.booking_transition_allowed', 'true', true);
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

  inserted_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_confirmation_id', null,
      'confirmation_link_id', inserted_link_id,
      'event_type', 'BOOKING_CONFIRMATION_REQUESTED',
      'recipient_email', normalized_contact_email
    ));

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    case
      when revoked_count > 0 then 'CONFIRMATION_LINK_REGENERATED'::public.audit_event_type
      else 'CONFIRMATION_LINK_CREATED'::public.audit_event_type
    end,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_link_id', inserted_link_id,
      'expires_at', p_expires_at,
      'replaced_link_count', revoked_count,
      'source', 'confirmation_email_request',
      'email_event_id', inserted_event_id
    )
  );

  return query
    select
      inserted_link_id,
      inserted_event_id,
      normalized_contact_email,
      p_expires_at,
      revoked_count,
      'created'::text;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reschedule_booking_with_notification(p_booking_id uuid, p_scheduled_for timestamp with time zone, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_id uuid, previous_scheduled_for timestamp with time zone, new_scheduled_for timestamp with time zone, status public.booking_status, confirmation_link_id uuid, expires_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_user_id uuid := auth.uid();
  reschedule_result record;
  booking_row public.bookings;
  confirmation_row public.booking_confirmations;
  change_row public.booking_changes;
  notification_recipient text;
  created_confirmation_link_id uuid;
  created_email_event_id uuid;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '48 hours' then
    raise exception 'confirmation_link_expiration_invalid' using errcode = '22023';
  end if;

  select *
  into reschedule_result
  from public.reschedule_booking(p_booking_id, p_scheduled_for);

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = reschedule_result.booking_id
  for update;

  select confirmation.*
  into confirmation_row
  from public.booking_confirmations as confirmation
  where confirmation.business_id = booking_row.business_id
    and confirmation.booking_id = booking_row.id
  order by confirmation.confirmed_at desc, confirmation.id desc
  limit 1;

  if confirmation_row.id is not null then
    notification_recipient := private.normalize_customer_contact_email(
      confirmation_row.contact_email
    );
  end if;

  if confirmation_row.id is not null and notification_recipient is not null then
    select change.*
    into change_row
    from public.booking_changes as change
    where change.business_id = booking_row.business_id
      and change.booking_id = booking_row.id
      and change.changed_by = caller_user_id
      and change.change_type = 'reschedule'
      and change.previous_scheduled_for is not distinct from reschedule_result.previous_scheduled_for
      and change.new_scheduled_for is not distinct from reschedule_result.new_scheduled_for
    order by change.created_at desc, change.id desc
    limit 1;
    if change_row.id is null then
      raise exception 'reschedule_change_evidence_unavailable' using errcode = '23000';
    end if;

    insert into public.confirmation_links (
      business_id, booking_id, token_hash, expires_at, created_by
    )
    values (
      booking_row.business_id, booking_row.id, p_token_hash,
      p_expires_at, caller_user_id
    )
    returning id into created_confirmation_link_id;

    created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_change_id', change_row.id,
      'confirmation_link_id', created_confirmation_link_id,
      'event_type', 'BOOKING_RESCHEDULED',
      'recipient_email', notification_recipient
    ));

    insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
    values (
      caller_user_id,
      booking_row.business_id,
      'CONFIRMATION_LINK_CREATED',
      jsonb_build_object(
        'booking_id', booking_row.id,
        'confirmation_link_id', created_confirmation_link_id,
        'expires_at', p_expires_at,
        'source', 'booking_rescheduled',
        'email_event_created', true
      )
    );
  end if;

  return query
  select
    reschedule_result.booking_id,
    reschedule_result.previous_scheduled_for,
    reschedule_result.new_scheduled_for,
    reschedule_result.status,
    created_confirmation_link_id,
    case when created_confirmation_link_id is null then null else p_expires_at end,
    created_email_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_booking_addon(p_booking_addon_id uuid, p_token_hash text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_addon_id uuid, confirmation_link_id uuid, expires_at timestamp with time zone, replaced_link_count integer, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select 1 from public.booking_amendments as amendment
    where amendment.booking_id = booking_row.id
      and amendment.status = 'PENDING_CUSTOMER'
  ) then
    raise exception 'booking_has_pending_amendment_request' using errcode = '23000';
  end if;
  if exists (
    select 1 from public.booking_addons as other_addon
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

  customer_email := private.normalize_customer_contact_email(
    confirmation_row.contact_email
  );
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
    business_id, booking_id, booking_addon_id, token_hash, expires_at, created_by
  )
  values (
    addon_row.business_id, addon_row.booking_id, addon_row.id,
    p_token_hash, p_expires_at, caller_user_id
  )
  returning id into created_link_id;

  created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', addon_row.business_id,
      'booking_id', addon_row.booking_id,
      'customer_id', booking_row.customer_id,
      'booking_addon_id', addon_row.id,
      'booking_addon_confirmation_link_id', created_link_id,
      'event_type', 'BOOKING_ADDON_REQUESTED',
      'recipient_email', customer_email
    ));

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
$function$
;

CREATE OR REPLACE FUNCTION public.transition_booking_status(p_booking_id uuid, p_to_status public.booking_status, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS TABLE(booking_id uuid, from_status public.booking_status, to_status public.booking_status, changed_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  updated_row public.bookings;
  confirmation_row public.booking_confirmations;
  payment_totals record;
  clean_reason text;
  notification_recipient text;
  created_email_event_id uuid;
  v_changed_at timestamptz := clock_timestamp();
  audit_type public.audit_event_type;
begin
  if caller_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;
  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized' using errcode = '42501';
  end if;
  if booking_row.status = p_to_status then
    raise exception 'booking_already_in_target_status' using errcode = '23000';
  end if;

  clean_reason := nullif(trim(coalesce(p_cancellation_reason, '')), '');
  if p_to_status = 'CANCELLED'
    and clean_reason is not null
    and char_length(clean_reason) > 500
  then
    raise exception 'cancellation_reason_too_long' using errcode = '22023';
  end if;
  if p_to_status = 'CANCELLED'
    and clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'
  then
    raise exception 'cancellation_reason_must_be_plain_text' using errcode = '22023';
  end if;
  if p_to_status = 'CANCELLED'
    and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    and clean_reason is null
  then
    raise exception 'cancellation_reason_required' using errcode = '22023';
  end if;
  if p_to_status <> 'CANCELLED' and clean_reason is not null then
    raise exception 'cancellation_reason_only_allowed_for_cancellation' using errcode = '22023';
  end if;

  if booking_row.status = 'DELIVERED' and p_to_status = 'COMPLETED' then
    select *
    into payment_totals
    from private.booking_payment_totals(booking_row.business_id, booking_row.id);
    if payment_totals.outstanding_amount_minor > 0 then
      raise exception 'outstanding_balance' using errcode = '23514';
    end if;
  end if;

  perform set_config('app.booking_transition_allowed', 'true', true);
  update public.bookings as booking
  set status = p_to_status,
      cancellation_reason = case
        when p_to_status = 'CANCELLED' then clean_reason
        else null
      end
  where booking.id = booking_row.id
  returning booking.* into updated_row;

  if p_to_status in ('READY', 'CANCELLED') then
    perform private.revoke_pending_booking_amendments(
      booking_row.id,
      case when p_to_status = 'CANCELLED' then 'booking_cancelled' else 'booking_advanced' end,
      caller_user_id
    );
  end if;

  if (
    p_to_status = 'DELIVERED'
    or (
      p_to_status = 'CANCELLED'
      and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    )
  ) then
    select confirmation.*
    into confirmation_row
    from public.booking_confirmations as confirmation
    where confirmation.business_id = booking_row.business_id
      and confirmation.booking_id = booking_row.id
    order by confirmation.confirmed_at desc, confirmation.id desc
    limit 1;

    notification_recipient := private.normalize_customer_contact_email(
      confirmation_row.contact_email
    );

    if confirmation_row.id is not null and notification_recipient is not null then
      created_email_event_id := private.enqueue_booking_communication(jsonb_build_object(
      'business_id', booking_row.business_id,
      'booking_id', booking_row.id,
      'customer_id', booking_row.customer_id,
      'booking_confirmation_id', confirmation_row.id,
      'event_type', case
          when p_to_status = 'DELIVERED' then 'BOOKING_DELIVERED'::public.email_event_type
          else 'BOOKING_CANCELLED'::public.email_event_type
        end,
      'recipient_email', notification_recipient
    ));

      if created_email_event_id is null then
        select event.id
        into created_email_event_id
        from public.email_events as event
        where event.booking_confirmation_id = confirmation_row.id
          and event.event_type = case
            when p_to_status = 'DELIVERED' then 'BOOKING_DELIVERED'::public.email_event_type
            else 'BOOKING_CANCELLED'::public.email_event_type
          end;
      end if;
    end if;
  end if;

  audit_type := case
    when p_to_status = 'CANCELLED' then 'BOOKING_CANCELLED'::public.audit_event_type
    when p_to_status = 'COMPLETED' then 'BOOKING_COMPLETED'::public.audit_event_type
    else 'BOOKING_STATUS_CHANGED'::public.audit_event_type
  end;
  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values (
    caller_user_id,
    booking_row.business_id,
    audit_type,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'from_status', booking_row.status,
      'to_status', p_to_status,
      'cancellation_reason_provided', clean_reason is not null,
      'email_event_created', created_email_event_id is not null
    )
  );

  return query
  select updated_row.id, booking_row.status, updated_row.status,
    v_changed_at, created_email_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_confirmation_request_with_channels(p_booking_id uuid, p_contact_email text, p_capability_token text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(confirmation_link_id uuid, email_event_id uuid, recipient_email text, expires_at timestamp with time zone, replaced_link_count integer, request_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_capability_token !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'invalid_capability'; end if;
  select * into r from public.create_booking_confirmation_request(p_booking_id, p_contact_email, encode(extensions.digest(p_capability_token,'sha256'),'hex'), p_expires_at);
  perform private.capture_whatsapp_capability(p_booking_id,p_capability_token);
  return query select r.confirmation_link_id, r.email_event_id, r.recipient_email, r.expires_at, r.replaced_link_count, r.request_status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_booking_amendment_with_channels(p_booking_id uuid, p_reason text, p_title text, p_description text, p_currency public.booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_capability_token text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(amendment_id uuid, expires_at timestamp with time zone, replaced_amendment_count integer, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_capability_token !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'invalid_capability'; end if;
  select * into r from public.create_booking_amendment(p_booking_id, p_reason, p_title, p_description, p_currency, p_total_amount_minor, p_deposit_amount_minor, p_scheduled_for, encode(extensions.digest(p_capability_token,'sha256'),'hex'), p_expires_at);
  perform private.capture_whatsapp_capability(p_booking_id,p_capability_token);
  return query select r.amendment_id, r.expires_at, r.replaced_amendment_count, r.email_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_booking_addon_with_channels(p_booking_addon_id uuid, p_capability_token text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_addon_id uuid, confirmation_link_id uuid, expires_at timestamp with time zone, replaced_link_count integer, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_capability_token !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'invalid_capability'; end if;
  select * into r from public.submit_booking_addon(p_booking_addon_id, encode(extensions.digest(p_capability_token,'sha256'),'hex'), p_expires_at);
  perform private.capture_whatsapp_capability((select a.booking_id from public.booking_addons a where a.id=p_booking_addon_id),p_capability_token);
  return query select r.booking_addon_id, r.confirmation_link_id, r.expires_at, r.replaced_link_count, r.email_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_booking_with_notification_with_channels(p_booking_id uuid, p_scheduled_for timestamp with time zone, p_capability_token text, p_expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval))
 RETURNS TABLE(booking_id uuid, previous_scheduled_for timestamp with time zone, new_scheduled_for timestamp with time zone, status public.booking_status, confirmation_link_id uuid, expires_at timestamp with time zone, email_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_capability_token !~ '^[A-Za-z0-9_-]{32,128}$' then raise exception 'invalid_capability'; end if;
  select * into r from public.reschedule_booking_with_notification(p_booking_id, p_scheduled_for, encode(extensions.digest(p_capability_token,'sha256'),'hex'), p_expires_at);
  perform private.capture_whatsapp_capability(p_booking_id,p_capability_token);
  return query select r.booking_id, r.previous_scheduled_for, r.new_scheduled_for, r.status, r.confirmation_link_id, r.expires_at, r.email_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.deliver_booking_with_feedback(p_booking_id uuid)
 RETURNS TABLE(booking_id uuid, booking_status public.booking_status, email_event_id uuid, feedback_link_id uuid, feedback_token text, expires_at timestamp with time zone, reused boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

    if found then
      select feedback_link.*
      into v_link
      from public.feedback_links as feedback_link
      where feedback_link.id = v_event.feedback_link_id
        and feedback_link.business_id = v_event.business_id
        and feedback_link.booking_id = v_event.booking_id;
    else
      -- WhatsApp-only delivery has no email row. Reuse the exact previously
      -- associated feedback capability, retaining all original validation below.
      select feedback_link.* into v_link
      from public.whatsapp_events w
      join private.whatsapp_capabilities c on c.event_id=w.id and c.path_prefix='f'
      join public.feedback_links feedback_link on feedback_link.token_hash=c.token_hash
        and feedback_link.business_id=w.business_id and feedback_link.booking_id=w.booking_id
      where w.business_id=v_booking.business_id and w.booking_id=v_booking.id
        and w.event_type='BOOKING_DELIVERED'
      order by w.created_at desc,w.id desc limit 1;
    end if;

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

  if v_transition.email_event_id is not null then
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
  end if;

  insert into private.whatsapp_capabilities(event_id,path_prefix,ciphertext,token_hash,expires_at)
  select e.id,'f',extensions.pgp_sym_encrypt(v_created.feedback_token,private.whatsapp_capability_key(),'cipher-algo=aes256,compress-algo=0'),
    encode(extensions.digest(v_created.feedback_token,'sha256'),'hex'),v_created.expires_at
  from public.whatsapp_events e where e.booking_id=v_booking.id and e.business_id=v_booking.business_id
    and e.event_type='BOOKING_DELIVERED' and e.status='PENDING'
  on conflict(event_id) do nothing;

  return query
  select v_booking.id, 'DELIVERED'::public.booking_status, v_event.id,
    v_created.feedback_link_id, v_created.feedback_token,
    v_created.expires_at, false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_with_channels(p_email_enabled boolean, p_whatsapp_enabled boolean, p_whatsapp_recipient text, p_whatsapp_consent boolean, p_business_id uuid, p_customer_mode text, p_customer_id uuid, p_new_customer_name text, p_new_customer_email text, p_new_customer_phone text, p_title text, p_description text, p_currency public.booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_internal_notes text)
 RETURNS TABLE(booking_id uuid, customer_id uuid, customer_created boolean, reference text, status public.booking_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_email_enabled is null or p_whatsapp_enabled is null or not (p_email_enabled or p_whatsapp_enabled) then raise exception 'channel_required'; end if;
  if not exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=p_business_id and p.enabled)
    or not private.is_business_member(p_business_id) then raise exception 'whatsapp_pilot_not_authorized' using errcode='42501'; end if;
  if p_whatsapp_enabled and (p_whatsapp_consent is distinct from true or p_whatsapp_recipient is null or p_whatsapp_recipient !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'whatsapp_consent_required'; end if;
  select * into r from public.create_booking_with_customer(p_business_id, p_customer_mode, p_customer_id, p_new_customer_name, p_new_customer_email, p_new_customer_phone, p_title, p_description, p_currency, p_total_amount_minor, p_deposit_amount_minor, p_scheduled_for, p_internal_notes);
  insert into public.booking_communication_preferences(booking_id,business_id,email_enabled,whatsapp_enabled,recipient_e164,consent_at,consent_source)
  values(r.booking_id,p_business_id,p_email_enabled,p_whatsapp_enabled,
    case when p_whatsapp_enabled then p_whatsapp_recipient end,case when p_whatsapp_enabled then now() end,
    case when p_whatsapp_enabled then 'VENDOR_CONFIRMED' end);
  return query select r.booking_id,r.customer_id,r.customer_created,r.reference,r.status;
end;
$function$;

create function public.get_whatsapp_admin_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.status='ACTIVE' and a.role='SUPER_ADMIN') then raise exception 'unauthorized' using errcode='42501'; end if;
  return (select jsonb_build_object('pending',count(*) filter(where status='PENDING'),
    'unknown',count(*) filter(where status='UNKNOWN'),
    'failed_recently',count(*) filter(where status='FAILED' and updated_at>now()-interval '24 hours')) from public.whatsapp_events);
end $$;

-- Harden every new function in this migration. Existing replacement ACLs stay unchanged.

alter function private.whatsapp_capability_key() owner to postgres;
revoke all on function private.whatsapp_capability_key() from public,anon,authenticated,service_role;

alter function private.enqueue_booking_communication(jsonb) owner to postgres;
revoke all on function private.enqueue_booking_communication(jsonb) from public,anon,authenticated,service_role;

alter function private.whatsapp_link_context(public.whatsapp_events) owner to postgres;
revoke all on function private.whatsapp_link_context(public.whatsapp_events) from public,anon,authenticated,service_role;

alter function private.capture_whatsapp_capability(uuid,text) owner to postgres;
revoke all on function private.capture_whatsapp_capability(uuid,text) from public,anon,authenticated,service_role;

alter function public.disable_booking_whatsapp(uuid) owner to postgres;
revoke all on function public.disable_booking_whatsapp(uuid) from public,anon,authenticated,service_role;
grant execute on function public.disable_booking_whatsapp(uuid) to authenticated;

alter function public.claim_whatsapp_event(uuid[]) owner to postgres;
revoke all on function public.claim_whatsapp_event(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.claim_whatsapp_event(uuid[]) to service_role;

alter function public.finish_whatsapp_event(uuid,uuid,text,text,text,boolean) owner to postgres;
revoke all on function public.finish_whatsapp_event(uuid,uuid,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.finish_whatsapp_event(uuid,uuid,text,text,text,boolean) to service_role;

alter function public.get_whatsapp_dispatch_context(uuid,uuid) owner to postgres;
revoke all on function public.get_whatsapp_dispatch_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_whatsapp_dispatch_context(uuid,uuid) to service_role;

alter function public.create_booking_confirmation_request_with_channels(uuid,text,text,timestamp with time zone) owner to postgres;
revoke all on function public.create_booking_confirmation_request_with_channels(uuid,text,text,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_confirmation_request_with_channels(uuid,text,text,timestamp with time zone) to authenticated;

alter function public.create_booking_amendment_with_channels(uuid,text,text,text,public.booking_currency,bigint,bigint,timestamp with time zone,text,timestamp with time zone) owner to postgres;
revoke all on function public.create_booking_amendment_with_channels(uuid,text,text,text,public.booking_currency,bigint,bigint,timestamp with time zone,text,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_amendment_with_channels(uuid,text,text,text,public.booking_currency,bigint,bigint,timestamp with time zone,text,timestamp with time zone) to authenticated;

alter function public.submit_booking_addon_with_channels(uuid,text,timestamp with time zone) owner to postgres;
revoke all on function public.submit_booking_addon_with_channels(uuid,text,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.submit_booking_addon_with_channels(uuid,text,timestamp with time zone) to authenticated;

alter function public.reschedule_booking_with_notification_with_channels(uuid,timestamp with time zone,text,timestamp with time zone) owner to postgres;
revoke all on function public.reschedule_booking_with_notification_with_channels(uuid,timestamp with time zone,text,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.reschedule_booking_with_notification_with_channels(uuid,timestamp with time zone,text,timestamp with time zone) to authenticated;

alter function public.create_booking_with_channels(boolean,boolean,text,boolean,uuid,text,uuid,text,text,text,text,text,public.booking_currency,bigint,bigint,timestamp with time zone,text) owner to postgres;
revoke all on function public.create_booking_with_channels(boolean,boolean,text,boolean,uuid,text,uuid,text,text,text,text,text,public.booking_currency,bigint,bigint,timestamp with time zone,text) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_with_channels(boolean,boolean,text,boolean,uuid,text,uuid,text,text,text,text,text,public.booking_currency,bigint,bigint,timestamp with time zone,text) to authenticated;

alter function public.get_whatsapp_admin_summary() owner to postgres;
revoke all on function public.get_whatsapp_admin_summary() from public,anon,authenticated,service_role;
grant execute on function public.get_whatsapp_admin_summary() to authenticated;

notify pgrst,'reload schema';
commit;
