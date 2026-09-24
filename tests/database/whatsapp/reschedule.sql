-- Only executed in the disposable native full-schema runner. Synthetic data only.
-- Real RPCs, integrity triggers, confirmation capabilities and channel enqueueing.
do $$
declare
  pilot uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '20000000-0000-4000-8000-000000000001';
  b record; r record; amendment record; row_after public.bookings; result jsonb;
  mode text; lifecycle text; token text; first_token text; old_ready timestamptz;
  expected_status text;
begin
 foreach mode in array array['email_only','whatsapp_only','both'] loop
  foreach lifecycle in array array['DRAFT','AWAITING_CUSTOMER','CONFIRMED','IN_PROGRESS','READY','DELIVERED','COMPLETED','CANCELLED'] loop
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   perform set_config('app.booking_transition_allowed','false',true);
   perform set_config('app.booking_reschedule_allowed','false',true);
   perform set_config('app.booking_amendment_allowed','false',true);
   perform set_config('app.booking_addon_workflow_allowed','false',true);
   select * into b from public.create_booking_with_channels(mode<>'whatsapp_only',mode<>'email_only','+15555550123',true,pilot,'new',null,'Reschedule fixture',null,null,'Reschedule fixture',null,'EUR',1000,0,now()+interval '1 day',null);
   -- Simulate an old overdue booking before creating its immutable confirmation.
   perform set_config('session_replication_role','replica',true);
   update public.bookings set created_at=now()-interval '2 days', scheduled_for=now()-interval '1 day' where id=b.booking_id;
   perform set_config('session_replication_role','origin',true);
   first_token:=encode(extensions.gen_random_bytes(32),'hex');
   if lifecycle<>'DRAFT' then
    select * into r from public.create_booking_confirmation_request_with_channels(b.booking_id,'fixture@example.com',first_token,now()+interval '24 hours');
   end if;
   if lifecycle not in ('DRAFT','AWAITING_CUSTOMER') then
    perform set_config('request.jwt.claim.sub','',true);
    result:=public.confirm_booking_by_token_hash(encode(extensions.digest(first_token,'sha256'),'hex'),'fixture@example.com',null);
    if result->>'status'<>'confirmed' then raise exception 'fixture_confirmation_failed'; end if;
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    -- Fixture status covers legacy CONFIRMED and terminal rows without unrelated payment/delivery workflows.
    perform set_config('session_replication_role','replica',true);
    update public.bookings set status=lifecycle::public.booking_status,
      started_at=case when lifecycle in ('IN_PROGRESS','READY','DELIVERED','COMPLETED') then now()-interval '3 hours' else null end,
      ready_at=case when lifecycle in ('READY','DELIVERED','COMPLETED') then now()-interval '2 hours' else null end,
      delivered_at=case when lifecycle in ('DELIVERED','COMPLETED') then now()-interval '1 hour' else null end,
      completed_at=case when lifecycle='COMPLETED' then now() else null end,
      cancelled_at=case when lifecycle='CANCELLED' then now() else null end,
      cancellation_reason=case when lifecycle='CANCELLED' then 'Synthetic cancellation' else null end
    where id=b.booking_id;
    perform set_config('session_replication_role','origin',true);
   end if;
   select ready_at into old_ready from public.bookings where id=b.booking_id;
   perform set_config('app.booking_transition_allowed','false',true);
   perform set_config('app.booking_reschedule_allowed','false',true);
   -- Direct forged cross-tenant and anonymous RPC calls remain denied.
   perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
   begin
    perform public.reschedule_booking(b.booking_id,now()+interval '2 days');
    raise exception 'cross_tenant_accepted';
   exception when insufficient_privilege then null; end;
   perform set_config('request.jwt.claim.sub','',true);
   begin
    perform public.reschedule_booking(b.booking_id,now()+interval '2 days');
    raise exception 'anonymous_accepted';
   exception when invalid_authorization_specification then null; end;
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   token:=encode(extensions.gen_random_bytes(32),'hex');
   if lifecycle in ('DELIVERED','COMPLETED','CANCELLED') then
    begin
     perform public.reschedule_booking(b.booking_id,now()+interval '2 days');
     raise exception 'terminal_rpc_accepted';
    exception when integrity_constraint_violation then
     if sqlerrm<>'booking_not_eligible_for_reschedule' then raise; end if;
    end;
    begin
     perform public.reschedule_booking_with_notification_with_channels(b.booking_id,now()+interval '2 days',token,now()+interval '24 hours');
     raise exception 'terminal_channel_rpc_accepted';
    exception when integrity_constraint_violation then
     if sqlerrm<>'booking_not_eligible_for_reschedule' then raise; end if;
    end;
    if exists(select 1 from public.booking_changes where booking_id=b.booking_id) then raise exception 'terminal_history_changed'; end if;
    continue;
   end if;
   begin
    perform public.reschedule_booking(b.booking_id,now()-interval '1 hour');
    raise exception 'past_target_accepted';
   exception when invalid_parameter_value then
    if sqlerrm<>'scheduled_for_must_be_future' then raise; end if;
   end;
   if lifecycle='IN_PROGRESS' then
    select * into amendment from public.create_booking_amendment_with_channels(b.booking_id,'Synthetic pending change','Synthetic amended title',null,'EUR',1000,0,now()+interval '3 days',encode(extensions.gen_random_bytes(32),'hex'),now()+interval '24 hours');
   end if;
   select * into r from public.reschedule_booking_with_notification_with_channels(b.booking_id,now()+interval '2 days',token,now()+interval '24 hours');
   if lifecycle='IN_PROGRESS' then
    if not exists(select 1 from public.booking_amendments where id=amendment.amendment_id and status='REVOKED' and revoked_reason='booking_rescheduled') then
     raise exception 'pending_amendment_not_revoked';
    end if;
   end if;
   select * into row_after from public.bookings where id=b.booking_id;
   expected_status:=case when lifecycle in ('CONFIRMED','IN_PROGRESS') then 'AWAITING_CUSTOMER' else lifecycle end;
   if row_after.status::text<>expected_status or row_after.scheduled_for<>now()+interval '2 days' then raise exception 'status_or_schedule_wrong % %',mode,lifecycle; end if;
   if row_after.ready_at is distinct from old_ready then raise exception 'ready_timestamp_changed'; end if;
   if (select count(*) from public.booking_changes where booking_id=b.booking_id and change_type='reschedule')<>1 then raise exception 'missing_or_duplicate_change'; end if;
   if (select count(*) from public.audit_logs where metadata->>'booking_id'=b.booking_id::text and event_type='BOOKING_RESCHEDULED')<>1 then raise exception 'missing_or_duplicate_audit'; end if;
   if lifecycle in ('CONFIRMED','IN_PROGRESS','READY') then
    if (select count(*) from public.email_events where booking_id=b.booking_id and event_type='BOOKING_RESCHEDULED')<>(case when mode='whatsapp_only' then 0 else 1 end) then raise exception 'email_channel_mismatch'; end if;
    if (select count(*) from public.whatsapp_events where booking_id=b.booking_id and event_type='BOOKING_RESCHEDULED')<>(case when mode='email_only' then 0 else 1 end) then raise exception 'whatsapp_channel_mismatch'; end if;
    result:=public.get_confirmation_public_view(encode(extensions.digest(token,'sha256'),'hex'));
    if result->>'status'<>'valid' then raise exception 'replacement_capability_not_valid % %',lifecycle,result->>'status'; end if;
    if not public.record_confirmation_link_open(encode(extensions.digest(token,'sha256'),'hex')) then
     raise exception 'replacement_link_open_not_recorded';
    end if;
    if public.record_confirmation_link_open(encode(extensions.digest(token,'sha256'),'hex')) then
     raise exception 'replacement_link_open_duplicated';
    end if;
    if lifecycle='READY' then
     perform set_config('request.jwt.claim.sub','',true);
     begin
      update public.bookings set customer_confirmed_at=now(), confirmation_terms_hash=repeat('a',64), confirmation_terms_snapshot='{}'::jsonb where id=b.booking_id;
      raise exception 'unguarded_ready_confirmation_accepted';
     exception when integrity_constraint_violation then
      if sqlerrm<>'confirmation_terms_follow_status' then raise; end if;
     end;
     perform set_config('request.jwt.claim.sub',owner_id::text,true);
     begin
      perform public.transition_booking_status(b.booking_id,'DELIVERED',null);
      raise exception 'delivery_before_reconfirmation_accepted';
     exception when integrity_constraint_violation then
      if sqlerrm<>'booking_reconfirmation_required' then raise; end if;
     end;
    end if;
    -- Same schedule cannot append another intent or capability.
    begin
     perform public.reschedule_booking_with_notification_with_channels(b.booking_id,now()+interval '2 days',encode(extensions.gen_random_bytes(32),'hex'),now()+interval '24 hours');
     raise exception 'duplicate_reschedule_accepted';
    exception when invalid_parameter_value then
     if sqlerrm<>'booking_schedule_unchanged' then raise; end if;
    end;
    perform set_config('request.jwt.claim.sub','',true);
    result:=public.confirm_booking_by_token_hash(encode(extensions.digest(token,'sha256'),'hex'),'fixture@example.com',null);
    if result->>'status'<>'confirmed' then raise exception 'reconfirmation_failed'; end if;
    if (select status::text from public.bookings where id=b.booking_id)<>(case when lifecycle='READY' then 'READY' else 'IN_PROGRESS' end) then raise exception 'reconfirmation_changed_work_state'; end if;
    if (select ready_at from public.bookings where id=b.booking_id) is distinct from old_ready then raise exception 'reconfirmation_reset_ready_timestamp'; end if;
    result:=public.confirm_booking_by_token_hash(encode(extensions.digest(token,'sha256'),'hex'),'fixture@example.com',null);
    if result->>'status'<>'already_confirmed' then raise exception 'reconfirmation_replayed'; end if;
    result:=public.get_confirmation_public_view(encode(extensions.digest(first_token,'sha256'),'hex'));
    if result->>'status'<>'already_confirmed' then raise exception 'immutable_original_confirmation_lost'; end if;
   end if;
   raise notice 'PASS reschedule % / %',mode,lifecycle;
  end loop;
 end loop;
 raise notice 'PASS: all 24 status/channel combinations; overdue active schedules; terminal/tenant/anonymous denial; future-date validation; history; one intent per channel; secure reconfirmation; READY retained';
end $$;
