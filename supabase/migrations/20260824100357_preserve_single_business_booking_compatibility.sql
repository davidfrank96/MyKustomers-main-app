create function public.create_booking_with_customer(
  p_customer_mode text,
  p_customer_id uuid,
  p_new_customer_name text,
  p_new_customer_email text,
  p_new_customer_phone text,
  p_title text,
  p_description text,
  p_currency public.booking_currency,
  p_total_amount_minor bigint,
  p_deposit_amount_minor bigint,
  p_scheduled_for timestamptz,
  p_internal_notes text
)
returns table (
  booking_id uuid,
  customer_id uuid,
  customer_created boolean,
  reference text,
  status public.booking_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  active_membership_count bigint;
  selected_business_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select
    count(*),
    (array_agg(membership.business_id))[1]
  into active_membership_count, selected_business_id
  from public.business_members as membership
  where membership.user_id = actor_user_id
    and membership.status = 'active';

  if active_membership_count = 0 then
    raise exception 'active_business_membership_required' using errcode = '42501';
  end if;

  if active_membership_count > 1 then
    raise exception 'explicit_business_required' using errcode = '42501';
  end if;

  return query
  select *
  from public.create_booking_with_customer(
    selected_business_id,
    p_customer_mode,
    p_customer_id,
    p_new_customer_name,
    p_new_customer_email,
    p_new_customer_phone,
    p_title,
    p_description,
    p_currency,
    p_total_amount_minor,
    p_deposit_amount_minor,
    p_scheduled_for,
    p_internal_notes
  );
end;
$$;

revoke all on function public.create_booking_with_customer(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  public.booking_currency,
  bigint,
  bigint,
  timestamptz,
  text
) from public, anon, authenticated;

grant execute on function public.create_booking_with_customer(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  public.booking_currency,
  bigint,
  bigint,
  timestamptz,
  text
) to authenticated;

notify pgrst, 'reload schema';
