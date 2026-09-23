\set ON_ERROR_STOP on
create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
insert into public.businesses(id,name) values('10000000-0000-4000-8000-000000000001','Synthetic Vendor A'),('10000000-0000-4000-8000-000000000002','Synthetic Vendor B');
insert into public.business_members(business_id,user_id,status,role) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','active','owner');
insert into public.bookings(id,business_id,reference) values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','SYNTHETIC-A'),('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','SYNTHETIC-B');
insert into private.whatsapp_pilot_businesses values('10000000-0000-4000-8000-000000000001',true);
insert into public.business_feature_entitlements(business_id,feature_key,enabled,source) values('10000000-0000-4000-8000-000000000001','WHATSAPP_CUSTOMER_UPDATES',true,'PILOT');
insert into public.booking_communication_preferences(booking_id,business_id,email_enabled,whatsapp_enabled,recipient_e164,consent_at,consent_source)
values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,true,'+15555550123',now(),'VENDOR_CONFIRMED');
-- Nine existing semantic events, Both, and repeated same logical event.
do $$ declare kind text; source uuid; payload jsonb; before_email integer; before_wa integer;
begin
 foreach kind in array array['BOOKING_CONFIRMATION_REQUESTED','BOOKING_CONFIRMED','BOOKING_RESCHEDULED','BOOKING_CANCELLED','BOOKING_DELIVERED','BOOKING_AMENDMENT_REQUESTED','BOOKING_AMENDMENT_CONFIRMED','BOOKING_ADDON_REQUESTED','BOOKING_ADDON_CONFIRMED'] loop
  source:=gen_random_uuid();
  payload:=jsonb_build_object('business_id','10000000-0000-4000-8000-000000000001','booking_id','30000000-0000-4000-8000-000000000001','event_type',kind,'recipient_email','fixture@example.com','booking_confirmation_id',source,
    'confirmation_link_id',case when kind='BOOKING_CONFIRMATION_REQUESTED' then source end,'booking_change_id',case when kind='BOOKING_RESCHEDULED' then source end,
    'booking_amendment_id',case when kind like 'BOOKING_AMENDMENT%' then source end,'booking_addon_id',case when kind like 'BOOKING_ADDON%' then source end,'booking_addon_confirmation_link_id',case when kind='BOOKING_ADDON_REQUESTED' then source end);
  select count(*) into before_email from public.email_events;
  select count(*) into before_wa from public.whatsapp_events;
  perform private.enqueue_booking_communication(payload);
  if kind in ('BOOKING_ADDON_CONFIRMED','BOOKING_AMENDMENT_CONFIRMED','BOOKING_CANCELLED','BOOKING_DELIVERED') then
    perform private.enqueue_booking_communication(payload);
  else
    begin
      perform private.enqueue_booking_communication(payload);
      raise exception 'expected original email unique violation';
    exception when unique_violation then null;
    end;
  end if;
  perform pg_temp.assert((select count(*)=before_email+1 from public.email_events),'one email intent: '||kind);
  perform pg_temp.assert((select count(*)=before_wa+1 from public.whatsapp_events),'one WhatsApp intent: '||kind);
 end loop;
end $$;
select pg_temp.assert((select count(*)=9 from public.whatsapp_events),'all nine events covered');
select pg_temp.assert(not has_table_privilege('authenticated','public.whatsapp_events','INSERT'),'vendor cannot create delivery evidence');
select pg_temp.assert(not has_column_privilege('authenticated','public.whatsapp_events','recipient_e164','SELECT'),'vendor delivery projection excludes phone');
select pg_temp.assert(not has_function_privilege('authenticated','public.claim_whatsapp_event(uuid[])','EXECUTE'),'worker service-only');
select pg_temp.assert(not has_function_privilege('anon','public.create_booking_with_channels(boolean,boolean,text,boolean,uuid,text,uuid,text,text,text,text,text,public.booking_currency,bigint,bigint,timestamptz,text)','EXECUTE'),'anonymous creation denied');
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select pg_temp.assert((select count(id)=9 from public.whatsapp_events),'same-business delivery read');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
select pg_temp.assert((select count(id)=0 from public.whatsapp_events),'cross-tenant delivery isolation');
select pg_temp.assert((select count(*)=0 from public.booking_communication_preferences),'cross-tenant preferences isolation');
reset role;
-- Safe non-acceptance retries append attempts, then stop at three.
do $$ declare e public.whatsapp_events;
begin
 for i in 1..3 loop
  select * into e from public.claim_whatsapp_event(array['10000000-0000-4000-8000-000000000001']::uuid[]);
  perform pg_temp.assert(e.id is not null,'claim succeeds');
  perform public.finish_whatsapp_event(e.id,e.lease_id,'FAILED','gateway_rate_limited',null,true);
  -- Isolate this logical event for deterministic retry testing.
  update public.whatsapp_events set next_attempt_at=case when id=e.id then now()-interval '1 second' else now()+interval '1 hour' end where status='PENDING';
 end loop;
 perform pg_temp.assert((select status='FAILED' and attempt_count=3 from public.whatsapp_events where id=e.id),'retry cap');
 perform pg_temp.assert((select count(*)=3 from private.whatsapp_attempts where event_id=e.id),'attempt ledger retained');
end $$;
-- Expired lease terminates UNKNOWN without a new claim for that event.
update public.whatsapp_events set next_attempt_at=now() where status='PENDING';
do $$ declare e public.whatsapp_events; next_event public.whatsapp_events;
begin
 select * into e from public.claim_whatsapp_event(array['10000000-0000-4000-8000-000000000001']::uuid[]);
 update public.whatsapp_events set lease_expires_at=now()-interval '1 second' where id=e.id;
 select * into next_event from public.claim_whatsapp_event(array['10000000-0000-4000-8000-000000000001']::uuid[]);
 perform pg_temp.assert(next_event.id<>e.id,'expired lease not replayed');
 perform pg_temp.assert((select status='UNKNOWN' from public.whatsapp_events where id=e.id),'expired lease UNKNOWN');
 perform pg_temp.assert(not public.finish_whatsapp_event(e.id,e.lease_id,'ACCEPTED',null,'late-provider-id',false),'stale finalizer denied');
end $$;
-- Stopping updates preserves email preference and cancels pending intents.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select public.disable_booking_whatsapp('30000000-0000-4000-8000-000000000001');
select pg_temp.assert((select email_enabled and not whatsapp_enabled and disabled_at is not null from public.booking_communication_preferences),'disable preserves email');
select pg_temp.assert((select count(*)=0 from public.whatsapp_events where status='PENDING'),'pending stopped');
select 'PASS: nine-event fanout, dedupe, tenant isolation, ACLs, bounded retries, attempt ledger, expired leases, disabled preference';
-- All nine events also obey WhatsApp-only, email-only and non-pilot channels.
do $$ declare kind text; mode text; source uuid; payload jsonb; emails bigint; wa bigint;
begin
 foreach mode in array array['whatsapp_only','email_only','non_pilot'] loop
  update public.booking_communication_preferences set email_enabled=(mode<>'whatsapp_only'),whatsapp_enabled=(mode<>'email_only'),disabled_at=null;
  update private.whatsapp_pilot_businesses set enabled=(mode<>'non_pilot');
  foreach kind in array array['BOOKING_CONFIRMATION_REQUESTED','BOOKING_CONFIRMED','BOOKING_RESCHEDULED','BOOKING_CANCELLED','BOOKING_DELIVERED','BOOKING_AMENDMENT_REQUESTED','BOOKING_AMENDMENT_CONFIRMED','BOOKING_ADDON_REQUESTED','BOOKING_ADDON_CONFIRMED'] loop
   source:=gen_random_uuid();
   payload:=jsonb_build_object('business_id','10000000-0000-4000-8000-000000000001','booking_id','30000000-0000-4000-8000-000000000001','event_type',kind,'recipient_email','fixture@example.com','booking_confirmation_id',source,
    'confirmation_link_id',case when kind='BOOKING_CONFIRMATION_REQUESTED' then source end,'booking_change_id',case when kind='BOOKING_RESCHEDULED' then source end,
    'booking_amendment_id',case when kind like 'BOOKING_AMENDMENT%' then source end,'booking_addon_id',case when kind like 'BOOKING_ADDON%' then source end,'booking_addon_confirmation_link_id',case when kind='BOOKING_ADDON_REQUESTED' then source end);
   select count(*) into emails from public.email_events;
   select count(*) into wa from public.whatsapp_events;
   perform private.enqueue_booking_communication(payload);
   if mode='whatsapp_only' then perform private.enqueue_booking_communication(payload); end if;
   perform pg_temp.assert((select count(*)=emails+case when mode='whatsapp_only' then 0 else 1 end from public.email_events),'email choice '||mode||kind);
   perform pg_temp.assert((select count(*)=wa+case when mode='whatsapp_only' then 1 else 0 end from public.whatsapp_events),'WhatsApp choice '||mode||kind);
  end loop;
 end loop;
end $$;
-- Same secure capability in the email association and encrypted WhatsApp context.
update private.whatsapp_pilot_businesses set enabled=true;
update public.booking_communication_preferences set email_enabled=true,whatsapp_enabled=true,disabled_at=null;
do $$ declare link uuid:=gen_random_uuid(); token text:=repeat('s',43); ev uuid; e public.whatsapp_events; context jsonb;
begin
 insert into public.confirmation_links(id,business_id,booking_id,token_hash,expires_at)
 values(link,'10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',encode(extensions.digest(token,'sha256'),'hex'),now()+interval '24 hours');
 ev:=private.enqueue_booking_communication(jsonb_build_object('business_id','10000000-0000-4000-8000-000000000001','booking_id','30000000-0000-4000-8000-000000000001','event_type','BOOKING_CONFIRMATION_REQUESTED','recipient_email','fixture@example.com','confirmation_link_id',link));
 perform private.capture_whatsapp_capability('30000000-0000-4000-8000-000000000001',token);
 update public.whatsapp_events set next_attempt_at=now()+interval '1 day' where capability_id is distinct from link;
 select * into e from public.claim_whatsapp_event(array['10000000-0000-4000-8000-000000000001']::uuid[]);
 context:=public.get_whatsapp_dispatch_context(e.id,e.lease_id);
 perform pg_temp.assert(context->>'token'=token,'exact same capability');
 perform pg_temp.assert((select confirmation_link_id=e.capability_id from public.email_events where id=ev),'same email/WhatsApp link identity');
 perform pg_temp.assert((select position(convert_to(token,'utf8') in ciphertext)=0 from private.whatsapp_capabilities where event_id=e.id),'no plaintext token persisted');
 update public.confirmation_links set revoked_at=now() where id=link;
 perform pg_temp.assert(public.get_whatsapp_dispatch_context(e.id,e.lease_id) is null,'revoked capability never dispatched');
 perform public.finish_whatsapp_event(e.id,e.lease_id,'CANCELLED','dispatch_context_unavailable');
end $$;
-- Constraint rejects missing consent; caller cannot forge the pilot or tenant.
do $$ begin
 begin
  update public.booking_communication_preferences set consent_at=null where whatsapp_enabled;
  raise exception 'constraint failed to reject consent';
 exception when check_violation then null; end;
 begin
  perform public.create_booking_with_channels(true,true,'+15555550123',true,'10000000-0000-4000-8000-000000000002','new',null,'Synthetic',null,null,'Synthetic',null,'EUR',0,0,null,null);
  raise exception 'nonpilot creation succeeded';
 exception when insufficient_privilege then null; end;
end $$;
select 'PASS: nine events x channel choices, exact shared capability, encrypted persistence, revocation, consent, non-pilot denial';
-- Leave multiple eligible rows for the external two-session concurrency proof.
update public.whatsapp_events set next_attempt_at=now() where status='PENDING';
