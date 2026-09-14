-- Disposable local PostgreSQL, with transaction-stable time at the 72h boundary.
begin;
create function pg_temp.assert(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
do $$
declare
  u uuid := gen_random_uuid(); other_user uuid := gen_random_uuid();
  b uuid := gen_random_uuid(); k uuid := gen_random_uuid();
  old_unread uuid := gen_random_uuid(); recent_read uuid := gen_random_uuid();
  boundary_read uuid := gen_random_uuid(); expired_read uuid := gen_random_uuid();
  expired_read_two uuid := gen_random_uuid(); old_read_at timestamptz := now()-interval '71 hours';
begin
  insert into auth.users(id) values(u),(other_user);
  insert into public.businesses values(b,now());
  insert into public.business_members(business_id,user_id) values(b,u),(b,other_user);
  insert into public.bookings(id,business_id,status) values(k,b,'CONFIRMED');
  insert into public.notifications(id,user_id,business_id,booking_id,notification_type,event_id,created_at,read_at) values
    (old_unread,u,b,k,'CUSTOMER_CONFIRMED',gen_random_uuid(),now()-interval '120 days',null),
    (gen_random_uuid(),other_user,b,k,'CUSTOMER_CONFIRMED',gen_random_uuid(),now()-interval '30 days',null),
    (recent_read,u,b,k,'CUSTOMER_CONFIRMED',gen_random_uuid(),now()-interval '120 days',old_read_at),
    (boundary_read,u,b,k,'CUSTOMER_CONFIRMED',gen_random_uuid(),now()-interval '10 days',now()-interval '72 hours'),
    (expired_read,u,b,k,'CUSTOMER_CONFIRMED',gen_random_uuid(),now()-interval '10 days',now()-interval '73 hours'),
    (expired_read_two,u,b,k,'CUSTOMER_CONFIRMED',gen_random_uuid(),now()-interval '10 days',now()-interval '74 hours');
  perform set_config('request.jwt.claim.sub',u::text,true);
  set local role authenticated;
  perform pg_temp.assert((select count(*)=3 from public.notifications where read_at is null or read_at>=now()-interval '72 hours'),'own list keeps old unread and 71h/exactly 72h read, omits 73h read');
  begin perform public.maintain_notifications(1); raise exception 'unexpected cleanup authority'; exception when insufficient_privilege then null; end;
  reset role;
  set local role service_role;
  perform public.maintain_notifications(1);
  reset role;
  perform pg_temp.assert((select count(*)=5 from public.notifications),'physical cleanup is bounded to one expired read');
  perform pg_temp.assert(exists(select 1 from public.notifications where id=old_unread),'120-day unread survives maintenance');
  perform public.maintain_notifications(1);
  perform public.maintain_notifications(1);
  perform pg_temp.assert((select count(*)=4 from public.notifications),'repeated cleanup is idempotent and exact 72h remains');
  perform set_config('request.jwt.claim.sub',u::text,true);
  set local role authenticated;
  update public.notifications set read_at=now() where user_id=u and read_at is null;
  update public.notifications set read_at=now() where id=recent_read and read_at is null;
  reset role;
  perform pg_temp.assert((select read_at=now() from public.notifications where id=old_unread),'mark all starts retention at read operation time');
  perform pg_temp.assert((select read_at=old_read_at from public.notifications where id=recent_read),'mark all and reopening preserve first read time');
  perform pg_temp.assert(exists(select 1 from public.notifications where user_id=other_user and read_at is null),'mark all preserves other user unread');
  perform pg_temp.assert(not has_table_privilege('service_role','public.notifications','DELETE'),'service role gains no direct deletion grant');
  perform pg_temp.assert(not has_function_privilege('anon','public.maintain_notifications(integer)','EXECUTE'),'anonymous maintenance denied');
end $$;
rollback;
