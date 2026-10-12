-- Only executed in the disposable native full-schema runner. Synthetic data only.
-- Real RPCs, integrity triggers, confirmation capabilities and channel enqueueing.
do $$
declare
  pilot uuid := '10000000-0000-4000-8000-000000000001';
  owner_id uuid := '20000000-0000-4000-8000-000000000001';
  b record; r record; amendment record; row_after public.bookings; result jsonb;
  mode text; lifecycle text; token text; first_token text; old_ready timestamptz;
  expected_status text; original_row public.bookings; original_proof jsonb; original_links integer; dispatch_event public.whatsapp_events;
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
   select * into original_row from public.bookings where id=b.booking_id;
   select jsonb_agg(to_jsonb(c) order by c.id) into original_proof from public.booking_confirmations c where c.booking_id=b.booking_id;
   select count(*) into original_links from public.confirmation_links where booking_id=b.booking_id;
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
     perform public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '2 days',token,now()+interval '24 hours');
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
   select * into r from public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '2 days',token,now()+interval '24 hours');
   if lifecycle='IN_PROGRESS' then
    if not exists(select 1 from public.booking_amendments where id=amendment.amendment_id and status='REVOKED' and revoked_reason='booking_rescheduled') then
     raise exception 'pending_amendment_not_revoked';
    end if;
   end if;
   select * into row_after from public.bookings where id=b.booking_id;
   expected_status:=lifecycle;
   if row_after.status::text<>expected_status or row_after.scheduled_for<>now()+interval '2 days' then raise exception 'status_or_schedule_wrong % %',mode,lifecycle; end if;
   if row_after.ready_at is distinct from old_ready then raise exception 'ready_timestamp_changed'; end if;
   if (select count(*) from public.booking_changes where booking_id=b.booking_id and change_type='reschedule')<>1 then raise exception 'missing_or_duplicate_change'; end if;
   if (select count(*) from public.audit_logs where metadata->>'booking_id'=b.booking_id::text and event_type='BOOKING_RESCHEDULED')<>1 then raise exception 'missing_or_duplicate_audit'; end if;
   if lifecycle in ('CONFIRMED','IN_PROGRESS','READY') then
    if (select count(*) from public.email_events where booking_id=b.booking_id and event_type='BOOKING_RESCHEDULED')<>(case when mode='whatsapp_only' then 0 else 1 end) then raise exception 'email_channel_mismatch'; end if;
    if (select count(*) from public.whatsapp_events where booking_id=b.booking_id and event_type='BOOKING_RESCHEDULED')<>(case when mode='email_only' then 0 else 1 end) then raise exception 'whatsapp_channel_mismatch'; end if;
    if r.confirmation_link_id is not null or r.expires_at is not null then raise exception 'operational_capability_created'; end if;
    if (select count(*) from public.confirmation_links where booking_id=b.booking_id)<>original_links then raise exception 'new_confirmation_link'; end if;
    if row_after.customer_confirmed_at is distinct from original_row.customer_confirmed_at
      or row_after.confirmation_terms_hash is distinct from original_row.confirmation_terms_hash
      or row_after.confirmation_terms_snapshot is distinct from original_row.confirmation_terms_snapshot
      or row_after.started_at is distinct from original_row.started_at then raise exception 'confirmation_or_operational_evidence_changed'; end if;
    if (select jsonb_agg(to_jsonb(c) order by c.id) from public.booking_confirmations c where c.booking_id=b.booking_id) is distinct from original_proof then raise exception 'historical_confirmation_changed'; end if;
    if exists(select 1 from public.whatsapp_events w join private.whatsapp_capabilities c on c.event_id=w.id where w.booking_id=b.booking_id and w.event_type='BOOKING_RESCHEDULED') then raise exception 'reschedule_encrypted_capability'; end if;
    -- Controlled flag must not leak into later updates in the same transaction.
    begin
      update public.bookings set scheduled_for=now()+interval '5 days' where id=b.booking_id;
      raise exception 'unguarded_schedule_change';
    exception when integrity_constraint_violation then
      if sqlerrm <> 'booking_reschedule_requires_controlled_operation' then raise; end if;
    end;
    begin
      update public.bookings set title='Forged title' where id=b.booking_id;
      raise exception 'unguarded_material_change';
    exception when integrity_constraint_violation then
      if sqlerrm <> 'customer_confirmed_material_terms_locked' then raise; end if;
    end;
    -- Same schedule cannot append another intent or capability.
    begin
     perform public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '2 days',encode(extensions.gen_random_bytes(32),'hex'),now()+interval '24 hours');
     raise exception 'duplicate_reschedule_accepted';
    exception when invalid_parameter_value then
     if sqlerrm<>'booking_schedule_unchanged' then raise; end if;
    end;
    -- A later distinct update must create a second intent against the SAME proof.
    select * into r from public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '3 days',null,null);
    if r.confirmation_link_id is not null then raise exception 'second_update_created_link'; end if;
    if (select count(*) from public.email_events where booking_id=b.booking_id and event_type='BOOKING_RESCHEDULED')<>(case when mode='whatsapp_only' then 0 else 2 end) then raise exception 'second_email_intent_missing'; end if;
    if mode<>'email_only' then
      select * into dispatch_event from public.whatsapp_events where booking_id=b.booking_id and event_type='BOOKING_RESCHEDULED' order by created_at,id limit 1;
      update public.whatsapp_events set status='PROCESSING',lease_id=gen_random_uuid(),lease_expires_at=now()+interval '1 minute' where id=dispatch_event.id returning * into dispatch_event;
      result:=public.get_whatsapp_dispatch_context(dispatch_event.id,dispatch_event.lease_id);
      if result is null or result->'schedule_update' is null or result->>'token' is not null or result->>'path_prefix' is not null then raise exception 'operational_dispatch_context_invalid'; end if;
      update public.whatsapp_events set source_id=gen_random_uuid() where id=dispatch_event.id;
      if public.get_whatsapp_dispatch_context(dispatch_event.id,dispatch_event.lease_id) is not null then raise exception 'forged_change_dispatch_allowed'; end if;
      update public.whatsapp_events set source_id=dispatch_event.source_id where id=dispatch_event.id;
    end if;
    if lifecycle='READY' then
      perform public.deliver_booking_with_feedback(b.booking_id);
      if (select status from public.bookings where id=b.booking_id)<>'DELIVERED' then raise exception 'ready_delivery_failed'; end if;
    end if;
    result:=public.get_confirmation_public_view(encode(extensions.digest(first_token,'sha256'),'hex'));
    if result->>'status'<>'already_confirmed' then raise exception 'immutable_original_confirmation_lost'; end if;
   end if;
   raise notice 'PASS reschedule % / %',mode,lifecycle;
  end loop;
 end loop;
 raise notice 'PASS: all 24 status/channel combinations; overdue active schedules; terminal/tenant/anonymous denial; future-date validation; history; one intent per channel; immutable confirmation; no reschedule capability; READY delivery';
end $$;

-- Historical missing-email and legacy READY cases use fixture-only corruption.
do $$
declare pilot uuid:='10000000-0000-4000-8000-000000000001'; owner_id text:='20000000-0000-4000-8000-000000000001'; b record; r record; proof uuid; token text; mode text; before_row public.bookings; after_row public.bookings;
begin
 foreach mode in array array['email_only','both','whatsapp_only','legacy_ready','legacy_api'] loop
  perform set_config('request.jwt.claim.sub',owner_id,true);
  perform set_config('app.booking_transition_allowed','false',true);
  perform set_config('app.booking_amendment_allowed','false',true);
  perform set_config('app.booking_reschedule_allowed','false',true);
  select * into b from public.create_booking_with_channels(mode<>'whatsapp_only',mode in ('both','whatsapp_only'),'+15555550123',true,pilot,'new',null,'Evidence fixture',null,null,'Evidence fixture',null,'EUR',1000,0,now()+interval '1 day',null);
  token:=encode(extensions.gen_random_bytes(32),'hex');
  perform public.create_booking_confirmation_request_with_channels(b.booking_id,'fixture@example.com',token,now()+interval '24 hours');
  perform set_config('request.jwt.claim.sub','',true);
  perform public.confirm_booking_by_token_hash(encode(extensions.digest(token,'sha256'),'hex'),'fixture@example.com',null);
  perform set_config('request.jwt.claim.sub',owner_id,true);
  if mode='legacy_api' then
    token:=encode(extensions.gen_random_bytes(32),'hex');
    select * into r from public.reschedule_booking_with_notification_with_channels(b.booking_id,now()+interval '2 days',token,now()+interval '24 hours');
    if r.status<>'AWAITING_CUSTOMER' or r.confirmation_link_id is null then raise exception 'deployed_app_compatibility_broken'; end if;
    continue;
  end if;
  if mode='legacy_ready' then
    perform public.transition_booking_status(b.booking_id,'READY',null);
    perform set_config('session_replication_role','replica',true);
    update public.bookings set customer_confirmed_at=null,confirmation_terms_hash=null,confirmation_terms_snapshot=null where id=b.booking_id;
    perform set_config('session_replication_role','origin',true);
    token:=encode(extensions.gen_random_bytes(32),'hex');
    select * into r from public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '2 days',token,now()+interval '24 hours');
    if r.confirmation_link_id is null or r.status<>'READY' then raise exception 'legacy_ready_confirmation_lost'; end if;
    begin
      perform public.deliver_booking_with_feedback(b.booking_id);
      raise exception 'legacy_delivery_before_confirmation';
    exception when integrity_constraint_violation then
      if sqlerrm<>'booking_reconfirmation_required' then raise; end if;
    end;
    perform set_config('request.jwt.claim.sub','',true);
    if public.confirm_booking_by_token_hash(encode(extensions.digest(token,'sha256'),'hex'),'fixture@example.com',null)->>'status'<>'confirmed' then raise exception 'legacy_ready_cannot_confirm'; end if;
    continue;
  end if;
  perform set_config('session_replication_role','replica',true);
  update public.booking_confirmations set contact_email=null where booking_id=b.booking_id;
  perform set_config('session_replication_role','origin',true);
  select * into before_row from public.bookings where id=b.booking_id;
  if mode='whatsapp_only' then
    select * into r from public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '2 days',null,null);
    if r.email_event_id is not null or r.confirmation_link_id is not null then raise exception 'whatsapp_only_missing_email_blocked'; end if;
  else
    begin
      perform public.reschedule_booking_update_with_channels(b.booking_id,now()+interval '2 days',null,null);
      raise exception 'missing_email_accepted';
    exception when integrity_constraint_violation then
      if sqlerrm<>'booking_confirmation_contact_unavailable' then raise; end if;
    end;
    select * into after_row from public.bookings where id=b.booking_id;
    if to_jsonb(before_row) is distinct from to_jsonb(after_row) or exists(select 1 from public.booking_changes where booking_id=b.booking_id) then raise exception 'missing_email_not_atomic'; end if;
  end if;
 end loop;
 raise notice 'PASS: missing confirmation contact fails atomically; WhatsApp-only independent; legacy READY still requires confirmation; deployed legacy RPC semantics unchanged';
end $$;
