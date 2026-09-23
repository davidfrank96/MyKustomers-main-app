-- One platform pause, no sender identity or QR persistence.
alter type public.audit_event_type add value if not exists 'WHATSAPP_SESSION_CONTROL';
begin;
create table private.whatsapp_control_state (
  singleton boolean primary key default true check (singleton),
  paused boolean not null default false,
  operation_id uuid,
  operation_actor uuid references auth.users(id),
  operation_action text check (operation_action in ('reconnect','pair','replace','unlink','resume')),
  operation_until timestamptz
);
alter table private.whatsapp_control_state enable row level security;
revoke all on private.whatsapp_control_state from public,anon,authenticated,service_role;
insert into private.whatsapp_control_state(singleton) values(true);

create function public.get_whatsapp_operations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=auth.uid() and status='ACTIVE' and role='SUPER_ADMIN') then raise exception 'unauthorized' using errcode='42501'; end if;
  return jsonb_build_object(
    'paused',(select paused from private.whatsapp_control_state where singleton),
    'summary',(select jsonb_build_object('pending',count(*) filter(where status='PENDING'),'processing',count(*) filter(where status='PROCESSING'),'accepted',count(*) filter(where status='ACCEPTED'),'unknown',count(*) filter(where status='UNKNOWN'),'failed_recently',count(*) filter(where status='FAILED' and updated_at>now()-interval '24 hours')) from public.whatsapp_events),
    'recent',coalesce((select jsonb_agg(to_jsonb(r)) from (select e.id,e.created_at,e.business_id,b.name as business_name,e.booking_id,e.event_type,e.status,e.attempt_count from public.whatsapp_events e join public.businesses b on b.id=e.business_id order by e.created_at desc,e.id desc limit 20) r),'[]'::jsonb),
    'businesses',coalesce((select jsonb_agg(to_jsonb(r)) from (select b.id,b.name from public.business_feature_entitlements f join public.businesses b on b.id=f.business_id where f.feature_key='WHATSAPP_CUSTOMER_UPDATES' and f.enabled order by b.name,b.id limit 100) r),'[]'::jsonb)
  );
end $$;
alter function public.get_whatsapp_operations() owner to postgres;
revoke all on function public.get_whatsapp_operations() from public,anon,authenticated,service_role;
grant execute on function public.get_whatsapp_operations() to authenticated;

create function public.begin_whatsapp_control(p_action text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare operation uuid:=gen_random_uuid(); current_state private.whatsapp_control_state;
begin
  if not exists(select 1 from public.platform_admins where user_id=auth.uid() and status='ACTIVE' and role='SUPER_ADMIN') or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_action is null or p_action not in ('reconnect','pair','replace','unlink','resume') or p_reason is null or char_length(trim(p_reason)) not between 1 and 500 or p_reason ~ '[0-9][0-9 ()+.-]{6,}[0-9]|@|https?://' then raise exception 'invalid_control_request'; end if;
  select * into strict current_state from private.whatsapp_control_state where singleton for update;
  if current_state.operation_until>now() then raise exception 'control_busy'; end if;
  update private.whatsapp_control_state set paused=true,operation_id=operation,operation_actor=auth.uid(),operation_action=p_action,operation_until=now()+interval '60 seconds' where singleton;
  insert into public.audit_logs(actor_user_id,event_type,metadata) values(auth.uid(),'WHATSAPP_SESSION_CONTROL',jsonb_build_object('operation_id',operation,'action',p_action,'result','REQUESTED','reason',trim(p_reason)));
  return operation;
end $$;
alter function public.begin_whatsapp_control(text,text) owner to postgres;
revoke all on function public.begin_whatsapp_control(text,text) from public,anon,authenticated,service_role;
grant execute on function public.begin_whatsapp_control(text,text) to authenticated;

-- Only the server can attest a gateway result; browser JWTs cannot resume claims.
create function public.finish_whatsapp_control(p_operation_id uuid,p_succeeded boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_state private.whatsapp_control_state;
begin
  select * into strict current_state from private.whatsapp_control_state where singleton for update;
  if p_succeeded is null or current_state.operation_id is distinct from p_operation_id or p_operation_id is null then return false; end if;
  insert into public.audit_logs(actor_user_id,event_type,metadata) values(current_state.operation_actor,'WHATSAPP_SESSION_CONTROL',jsonb_build_object('operation_id',p_operation_id,'action',current_state.operation_action,'result',case when p_succeeded then 'SUCCEEDED' else 'NOT_CONFIRMED' end));
  update private.whatsapp_control_state set paused=not(p_succeeded and current_state.operation_action='resume'),operation_id=null,operation_actor=null,operation_action=null,operation_until=null where singleton;
  return true;
end $$;
alter function public.finish_whatsapp_control(uuid,boolean) owner to postgres;
revoke all on function public.finish_whatsapp_control(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.finish_whatsapp_control(uuid,boolean) to service_role;

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
  if coalesce((select paused from private.whatsapp_control_state where singleton),true) then return; end if;
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


commit;
