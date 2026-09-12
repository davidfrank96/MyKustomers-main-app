-- Synthetic local fixture for two independent workers, retained only in the disposable cluster.
insert into auth.users(id) values ('90000000-0000-4000-8000-000000000001');
insert into public.businesses values('90000000-0000-4000-8000-000000000002',now());
insert into public.business_members(business_id,user_id) values('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001');
insert into public.bookings(id,business_id,status) values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','CONFIRMED');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
select public.register_push_subscription('https://fcm.googleapis.com/concurrency-one',repeat('a',87),repeat('b',22));
select public.register_push_subscription('https://fcm.googleapis.com/concurrency-two',repeat('a',87),repeat('b',22));
insert into public.booking_confirmations values('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003');
