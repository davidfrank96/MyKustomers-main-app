-- CI regression: real new RPC, fanout and integrity trigger; synthetic records only.
create trigger operational_booking_integrity before update on public.bookings for each row execute function private.enforce_booking_integrity();
do $$
declare b uuid; proof uuid; pilot uuid:='10000000-0000-4000-8000-000000000001'; owner_id uuid:='20000000-0000-4000-8000-000000000001'; mode text; state public.booking_status; r record; e public.whatsapp_events; context jsonb;
begin
 update public.business_feature_entitlements set enabled=true where business_id=pilot and feature_key='WHATSAPP_CUSTOMER_UPDATES';
 update private.whatsapp_pilot_businesses set enabled=true where business_id=pilot;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 foreach mode in array array['email_only','whatsapp_only','both'] loop
  foreach state in array array['CONFIRMED','IN_PROGRESS','READY']::public.booking_status[] loop
   b:=gen_random_uuid(); proof:=gen_random_uuid();
   insert into public.bookings(id,business_id,reference,title,currency,total_amount_minor,deposit_amount_minor,scheduled_for,status,created_by,customer_confirmed_at,confirmation_terms_hash,confirmation_terms_snapshot,started_at,ready_at)
   values(b,pilot,'SYNTHETIC','Fixture','EUR',1000,0,now()+interval '1 day',state,owner_id,now(),repeat('a',64),'{}',now(),case when state='READY' then now() end);
   insert into public.booking_confirmations(id,business_id,booking_id,terms_hash,terms_snapshot,confirmed_at,contact_email) values(proof,pilot,b,repeat('a',64),'{}',now(),'fixture@example.com');
   insert into public.booking_communication_preferences(booking_id,business_id,email_enabled,whatsapp_enabled,recipient_e164,consent_at,consent_source)
   values(b,pilot,mode<>'whatsapp_only',mode<>'email_only','+15555550123',now(),'VENDOR_CONFIRMED');
   select * into r from public.reschedule_booking_update_with_channels(b,now()+interval '2 days',null,null);
   if r.status<>state or r.confirmation_link_id is not null then raise exception 'operational_status_or_capability'; end if;
   perform public.reschedule_booking_update_with_channels(b,now()+interval '3 days',null,null);
   if (select count(*) from public.email_events where booking_id=b)<>(case when mode='whatsapp_only' then 0 else 2 end) then raise exception 'email_count'; end if;
   if (select count(*) from public.whatsapp_events where booking_id=b)<>(case when mode='email_only' then 0 else 2 end) then raise exception 'whatsapp_count'; end if;
   if exists(select 1 from public.confirmation_links where booking_id=b) then raise exception 'unexpected_link'; end if;
   if (select confirmation_terms_hash from public.bookings where id=b)<>repeat('a',64) then raise exception 'lost_evidence'; end if;
   begin
    update public.bookings set title='Forged' where id=b;
    raise exception 'material_guard_lost';
   exception when integrity_constraint_violation then null; end;
   if mode<>'email_only' then
    select * into e from public.whatsapp_events where booking_id=b order by id limit 1;
    update public.whatsapp_events set status='PROCESSING',lease_id=gen_random_uuid(),lease_expires_at=now()+interval '1 minute' where id=e.id returning * into e;
    context:=public.get_whatsapp_dispatch_context(e.id,e.lease_id);
    if context is null or context->'schedule_update' is null or context->>'token' is not null then raise exception 'context_invalid'; end if;
   end if;
  end loop;
 end loop;
 if has_function_privilege('anon','public.reschedule_booking_update(uuid,timestamptz,text,timestamptz)','EXECUTE') then raise exception 'anonymous_rpc'; end if;
 if has_function_privilege('authenticated','public.get_whatsapp_dispatch_context(uuid,uuid)','EXECUTE') then raise exception 'vendor_dispatch_context'; end if;
 raise notice 'PASS: operational schedules in all nine confirmed-state/channel combinations; repeated distinct updates; immutable evidence; no capability; material guard; dispatch context; RPC ACLs';
end $$;
