\set ON_ERROR_STOP on
begin;
create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
insert into public.business_feature_entitlements(business_id,feature_key,enabled,source) values('10000000-0000-4000-8000-000000000002','WHATSAPP_CUSTOMER_UPDATES',false,'PILOT');
insert into public.platform_admins(user_id,role,status) values('20000000-0000-4000-8000-000000000003','SUPER_ADMIN','ACTIVE');
select pg_temp.assert(not has_table_privilege('authenticated','public.business_feature_entitlements','INSERT,UPDATE,DELETE'),'no vendor writes');
select pg_temp.assert(not has_table_privilege('anon','public.business_feature_entitlements','SELECT'),'no anonymous read');
select pg_temp.assert(not has_function_privilege('authenticated','private.set_business_feature(uuid,text,boolean,text,text)','EXECUTE'),'no private mutation access');
select pg_temp.assert(not has_function_privilege('service_role','public.set_business_feature_entitlement(uuid,text,boolean,text)','EXECUTE'),'no service-role bypass');
update public.whatsapp_events set status='ACCEPTED' where id=(select id from public.whatsapp_events where status='FAILED' limit 1);
create temp table terminal_evidence as select id,status,attempt_count from public.whatsapp_events where status in ('ACCEPTED','UNKNOWN');
select pg_temp.assert(exists(select 1 from terminal_evidence where status='ACCEPTED'),'accepted history fixture exists');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select pg_temp.assert((select count(*)=1 from public.business_feature_entitlements),'member sees only own business');
select pg_temp.assert(public.get_whatsapp_rollout_access('10000000-0000-4000-8000-000000000001'),'member sees own operational gate');
do $$ begin
 begin
  perform public.set_business_feature_entitlement('10000000-0000-4000-8000-000000000001','WHATSAPP_CUSTOMER_UPDATES',false,'self grant attempt');
  raise exception 'ordinary vendor authorized';
 exception when insufficient_privilege then null; end;
 begin
  perform public.get_whatsapp_rollout_access('10000000-0000-4000-8000-000000000002');
  raise exception 'cross-tenant rollout read authorized';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select pg_temp.assert((select count(*)=0 from public.business_feature_entitlements),'unrelated user sees none');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select pg_temp.assert((select count(*)=2 from public.business_feature_entitlements),'active Super Admin reads feature access');
do $$ begin
 begin
  perform public.set_business_feature_entitlement('10000000-0000-4000-8000-000000000001','WHATSAPP_CUSTOMER_UPDATES',false,'requires MFA');
  raise exception 'aal1 mutation authorized';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select public.set_business_feature_entitlement('10000000-0000-4000-8000-000000000001','WHATSAPP_CUSTOMER_UPDATES',false,'Synthetic revoke');
reset role;
select pg_temp.assert((select count(*)=1 from public.audit_logs where event_type='BUSINESS_FEATURE_ENTITLEMENT_CHANGED' and actor_user_id='20000000-0000-4000-8000-000000000003' and metadata->>'enabled'='false'),'attributed audit');
select pg_temp.assert(not exists(select 1 from public.whatsapp_events where status='PENDING'),'pending intents cancelled');
select pg_temp.assert(exists(select 1 from public.whatsapp_events where status='UNKNOWN'),'UNKNOWN history preserved');
select pg_temp.assert(not exists(select 1 from terminal_evidence t left join public.whatsapp_events e using(id) where e.id is null or e.status<>t.status or e.attempt_count<>t.attempt_count),'ACCEPTED/UNKNOWN rows and attempt counts unchanged');
select pg_temp.assert(not exists(select 1 from public.claim_whatsapp_event(array['10000000-0000-4000-8000-000000000001']::uuid[])),'no claim after revoke');
select pg_temp.assert(not exists(select 1 from public.whatsapp_events e where status='PROCESSING' and public.get_whatsapp_dispatch_context(e.id,e.lease_id) is not null),'no dispatch after revoke');
do $$ declare before_wa integer; before_email integer; source uuid:=gen_random_uuid(); begin
 select count(*) into before_wa from public.whatsapp_events;
 select count(*) into before_email from public.email_events;
 perform private.enqueue_booking_communication(jsonb_build_object('business_id','10000000-0000-4000-8000-000000000001','booking_id','30000000-0000-4000-8000-000000000001','event_type','BOOKING_CONFIRMED','recipient_email','fixture@example.com','booking_confirmation_id',source));
 perform pg_temp.assert((select count(*)=before_wa from public.whatsapp_events),'no future WhatsApp intent after revoke');
 perform pg_temp.assert((select count(*)=before_email+1 from public.email_events),'Email continues after revoke');
 perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
 begin
  perform public.create_booking_with_channels(true,true,'+15555550123',true,'10000000-0000-4000-8000-000000000001','new',null,'Synthetic',null,null,'Synthetic',null,'EUR',0,0,null,null);
  raise exception 'forged revoked create authorized';
 exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
select public.set_business_feature_entitlement('10000000-0000-4000-8000-000000000001','WHATSAPP_CUSTOMER_UPDATES',true,'Synthetic regrant');
reset role;
select pg_temp.assert(private.has_business_feature('10000000-0000-4000-8000-000000000001','WHATSAPP_CUSTOMER_UPDATES'),'grant restores feature');
select pg_temp.assert(not exists(select 1 from public.whatsapp_events where status='PENDING'),'regrant does not replay cancelled or UNKNOWN intents');
rollback;
select 'PASS: entitlement RLS, tenant isolation, MFA/admin boundary, audited grant/revoke, create/enqueue/claim/dispatch denial, Email/history preservation, no replay';
