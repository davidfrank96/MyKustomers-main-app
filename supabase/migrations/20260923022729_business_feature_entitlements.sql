-- Generic product access; operational rollout remains an independent gate.
alter type public.audit_event_type add value if not exists 'BUSINESS_FEATURE_ENTITLEMENT_CHANGED';
begin;

create table public.business_feature_entitlements (
  business_id uuid not null references public.businesses(id) on delete restrict,
  feature_key text not null check (feature_key ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  enabled boolean not null default false,
  source text not null check (source in ('ADMIN','PILOT','BILLING','SYSTEM')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,feature_key)
);
alter table public.business_feature_entitlements enable row level security;
revoke all on public.business_feature_entitlements from public,anon,authenticated,service_role;
grant select on public.business_feature_entitlements to authenticated;

create function private.can_read_business_features(p_business_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (private.is_business_member(p_business_id) or exists (
    select 1 from public.platform_admins a where a.user_id=auth.uid() and a.role='SUPER_ADMIN' and a.status='ACTIVE'
  ));
$$;
alter function private.can_read_business_features(uuid) owner to postgres;
revoke all on function private.can_read_business_features(uuid) from public,anon,authenticated,service_role;
grant execute on function private.can_read_business_features(uuid) to authenticated;
create policy business_features_read on public.business_feature_entitlements
  for select to authenticated using (private.can_read_business_features(business_id));

create function private.has_business_feature(p_business_id uuid,p_feature_key text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.business_feature_entitlements e
    where e.business_id=p_business_id and e.feature_key=p_feature_key and e.enabled);
$$;
alter function private.has_business_feature(uuid,text) owner to postgres;
revoke all on function private.has_business_feature(uuid,text) from public,anon,authenticated,service_role;

-- Operational access reveals no provider details and cannot grant product access.
create function public.get_whatsapp_rollout_access(p_business_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.can_read_business_features(p_business_id) then raise exception 'unauthorized' using errcode='42501'; end if;
  return exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=p_business_id and p.enabled);
end $$;
alter function public.get_whatsapp_rollout_access(uuid) owner to postgres;
revoke all on function public.get_whatsapp_rollout_access(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_whatsapp_rollout_access(uuid) to authenticated;

-- Owner-only mutation boundary also supports an explicitly controlled bootstrap.
-- Future billing needs its own authenticated event boundary, not browser authority.
create function private.set_business_feature(p_business_id uuid,p_feature_key text,p_enabled boolean,p_source text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.business_feature_entitlements;
begin
  if p_business_id is null or p_feature_key is distinct from 'WHATSAPP_CUSTOMER_UPDATES'
    or p_enabled is null or p_source is null or p_source not in ('ADMIN','PILOT','BILLING','SYSTEM')
    or p_reason is null or char_length(trim(p_reason)) not between 1 and 500 then
    raise exception 'invalid_feature_change' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('business-feature:'||p_business_id::text||':'||p_feature_key,0));
  select * into previous from public.business_feature_entitlements where business_id=p_business_id and feature_key=p_feature_key for update;
  if previous.enabled is not distinct from p_enabled and previous.source is not distinct from p_source then return; end if;
  insert into public.business_feature_entitlements(business_id,feature_key,enabled,source)
    values(p_business_id,p_feature_key,p_enabled,p_source)
    on conflict(business_id,feature_key) do update set enabled=excluded.enabled,source=excluded.source,updated_at=now();
  if not p_enabled then
    update public.whatsapp_events set status='CANCELLED',error_code='feature_access_revoked',updated_at=now()
      where business_id=p_business_id and status='PENDING';
  end if;
  insert into public.audit_logs(actor_user_id,business_id,event_type,metadata)
    values(auth.uid(),p_business_id,'BUSINESS_FEATURE_ENTITLEMENT_CHANGED',jsonb_build_object(
      'feature_key',p_feature_key,'previous_enabled',previous.enabled,'enabled',p_enabled,'source',p_source,
      'reason',trim(p_reason),'actor_source',case when auth.uid() is null then 'CONTROLLED_DATABASE_OPERATOR' else 'AUTHENTICATED_SUPER_ADMIN' end));
end $$;
alter function private.set_business_feature(uuid,text,boolean,text,text) owner to postgres;
revoke all on function private.set_business_feature(uuid,text,boolean,text,text) from public,anon,authenticated,service_role;

create function public.set_business_feature_entitlement(p_business_id uuid,p_feature_key text,p_enabled boolean,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.role='SUPER_ADMIN' and a.status='ACTIVE') then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  if (auth.jwt()->>'aal') is distinct from 'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  perform private.set_business_feature(p_business_id,p_feature_key,p_enabled,'ADMIN',p_reason);
  return true;
end $$;
alter function public.set_business_feature_entitlement(uuid,text,boolean,text) owner to postgres;
revoke all on function public.set_business_feature_entitlement(uuid,text,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.set_business_feature_entitlement(uuid,text,boolean,text) to authenticated;

-- Preserve Phase 2 logic and ACLs, adding entitlement checks at every send boundary.
create or replace function private.enqueue_booking_communication(p_data jsonb) returns uuid
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
  if pref.whatsapp_enabled and pref.disabled_at is null and private.has_business_feature(e.business_id,'WHATSAPP_CUSTOMER_UPDATES') and exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=e.business_id and p.enabled) then
    source := coalesce(e.booking_change_id,e.booking_addon_confirmation_link_id,e.booking_amendment_id,e.confirmation_link_id,e.booking_addon_id,e.booking_confirmation_id);
    if source is null then raise exception 'whatsapp_event_source_missing'; end if;
    insert into public.whatsapp_events(business_id,booking_id,event_type,source_id,capability_id,contact_hash,idempotency_key,recipient_e164)
    values(e.business_id,e.booking_id,e.event_type::text,source,coalesce(e.confirmation_link_id,e.booking_addon_confirmation_link_id,e.booking_amendment_id),encode(extensions.digest(e.recipient_email,'sha256'),'hex'),
      encode(extensions.digest(concat_ws('|','whatsapp-v1',e.business_id,e.booking_id,e.event_type,source),'sha256'),'hex'),pref.recipient_e164)
    on conflict(business_id,booking_id,event_type,source_id) do nothing;
  end if;
  return email_id;
end $$;

create or replace function public.claim_whatsapp_event(p_business_ids uuid[]) returns setof public.whatsapp_events
language plpgsql security definer set search_path='' as $$
declare e public.whatsapp_events;
begin
  -- A lease expiry is ambiguous: terminate it, never re-send it.
  with stale as (select id from public.whatsapp_events where status='PROCESSING' and lease_expires_at<now() order by lease_expires_at limit 100 for update skip locked), expired as (
    update public.whatsapp_events set status='UNKNOWN',error_code='lease_expired',updated_at=now()
    where id in (select id from stale) returning id,lease_id
  ) update private.whatsapp_attempts a set status='UNKNOWN',error_code='lease_expired',finished_at=now()
    from expired x where a.event_id=x.id and a.lease_id=x.lease_id and a.status='PROCESSING';
  with stopped as (select q.id from public.whatsapp_events q join public.booking_communication_preferences p on p.booking_id=q.booking_id where q.status='PENDING' and (not p.whatsapp_enabled or not private.has_business_feature(q.business_id,'WHATSAPP_CUSTOMER_UPDATES')) order by q.id limit 100 for update of q skip locked)
  update public.whatsapp_events set status='CANCELLED',error_code='booking_updates_disabled',updated_at=now() where id in (select id from stopped);
  select q.* into e from public.whatsapp_events q
    join public.booking_communication_preferences p on p.booking_id=q.booking_id and p.business_id=q.business_id
    join private.whatsapp_pilot_businesses pilot on pilot.business_id=q.business_id and pilot.enabled
    where q.status='PENDING' and q.next_attempt_at <= now() and q.attempt_count<3
      and private.has_business_feature(q.business_id,'WHATSAPP_CUSTOMER_UPDATES') and q.business_id=any(p_business_ids) and p.whatsapp_enabled and p.disabled_at is null
    order by q.next_attempt_at,q.id limit 1 for update of q skip locked;
  if not found then return; end if;
  update public.whatsapp_events set status='PROCESSING',attempt_count=attempt_count+1,lease_id=gen_random_uuid(),lease_expires_at=now()+interval '45 seconds',updated_at=now()
    where id=e.id returning * into e;
  insert into private.whatsapp_attempts(event_id,attempt_number,lease_id,status) values(e.id,e.attempt_count,e.lease_id,'PROCESSING');
  return next e;
end $$;

create or replace function public.get_whatsapp_dispatch_context(p_event_id uuid,p_lease_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.whatsapp_events; b public.bookings; business_name text; c private.whatsapp_capabilities; link record; token text;
begin
  select * into e from public.whatsapp_events where id=p_event_id and lease_id=p_lease_id and status='PROCESSING' and lease_expires_at>now();
  if not found then return null; end if;
  if not exists(select 1 from public.booking_communication_preferences p where p.booking_id=e.booking_id and p.whatsapp_enabled and p.disabled_at is null)
    or not private.has_business_feature(e.business_id,'WHATSAPP_CUSTOMER_UPDATES')
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

create or replace function public.create_booking_with_channels(p_email_enabled boolean, p_whatsapp_enabled boolean, p_whatsapp_recipient text, p_whatsapp_consent boolean, p_business_id uuid, p_customer_mode text, p_customer_id uuid, p_new_customer_name text, p_new_customer_email text, p_new_customer_phone text, p_title text, p_description text, p_currency public.booking_currency, p_total_amount_minor bigint, p_deposit_amount_minor bigint, p_scheduled_for timestamp with time zone, p_internal_notes text)
 RETURNS TABLE(booking_id uuid, customer_id uuid, customer_created boolean, reference text, status public.booking_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if p_email_enabled is null or p_whatsapp_enabled is null or not (p_email_enabled or p_whatsapp_enabled) then raise exception 'channel_required'; end if;
  if not private.has_business_feature(p_business_id,'WHATSAPP_CUSTOMER_UPDATES')
    or not exists(select 1 from private.whatsapp_pilot_businesses p where p.business_id=p_business_id and p.enabled)
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

commit;
