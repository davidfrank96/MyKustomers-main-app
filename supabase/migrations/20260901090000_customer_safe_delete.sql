alter type public.audit_event_type
  add value if not exists 'CUSTOMER_DELETED';

create or replace function public.delete_customer_if_eligible(
  p_customer_id uuid
)
returns table (
  deleted boolean,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_row public.customers%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'customer_not_found_or_unavailable'
      using errcode = '42501';
  end if;

  select customer.*
  into customer_row
  from public.customers as customer
  where customer.id = p_customer_id
    and private.has_business_role(
      customer.business_id,
      array['owner']::public.business_member_role[]
    )
  for update;

  if not found then
    raise exception 'customer_not_found_or_unavailable'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.bookings as booking
    where booking.business_id = customer_row.business_id
      and booking.customer_id = customer_row.id
  ) then
    return query
      select false, 'booking_history_exists'::text;
    return;
  end if;

  begin
    delete from public.customers
    where id = customer_row.id
      and business_id = customer_row.business_id;
  exception
    when foreign_key_violation then
      return query
        select false, 'protected_dependency_exists'::text;
      return;
  end;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    (select auth.uid()),
    customer_row.business_id,
    'CUSTOMER_DELETED',
    jsonb_build_object('customer_id', customer_row.id)
  );

  return query
    select true, 'deleted'::text;
end;
$$;

revoke all on function public.delete_customer_if_eligible(uuid)
from public, anon, authenticated;

grant execute on function public.delete_customer_if_eligible(uuid)
to authenticated;

notify pgrst, 'reload schema';
