drop function public.create_booking_with_customer(
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
);

create function public.create_booking_with_customer(
  p_business_id uuid,
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
  current_business_id uuid;
  selected_customer_id uuid;
  created_booking_id uuid;
  created_booking_reference text;
  created_booking_status public.booking_status;
  normalized_customer_name text := nullif(trim(p_new_customer_name), '');
  normalized_customer_email text := nullif(lower(trim(p_new_customer_email)), '');
  normalized_customer_phone text := nullif(trim(p_new_customer_phone), '');
  possible_duplicate boolean := false;
  did_create_customer boolean := false;
begin
  if actor_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.business_id
  into current_business_id
  from public.business_members as membership
  where membership.user_id = actor_user_id
    and membership.business_id = p_business_id
    and membership.status = 'active'
  limit 1;

  if current_business_id is null then
    raise exception 'active_business_membership_required' using errcode = '42501';
  end if;

  if p_customer_mode = 'existing' then
    if p_customer_id is null
      or normalized_customer_name is not null
      or normalized_customer_email is not null
      or normalized_customer_phone is not null
    then
      raise exception 'invalid_existing_customer_payload' using errcode = '22023';
    end if;

    select customer.id
    into selected_customer_id
    from public.customers as customer
    where customer.id = p_customer_id
      and customer.business_id = current_business_id
      and customer.archived_at is null
    for key share;

    if selected_customer_id is null then
      raise exception 'customer_not_available' using errcode = '42501';
    end if;
  elsif p_customer_mode = 'new' then
    if p_customer_id is not null or normalized_customer_name is null then
      raise exception 'invalid_new_customer_payload' using errcode = '22023';
    end if;

    select exists (
      select 1
      from public.customers as customer
      where customer.business_id = current_business_id
        and customer.archived_at is null
        and (
          lower(trim(customer.name)) = lower(normalized_customer_name)
          or (
            normalized_customer_email is not null
            and lower(trim(customer.email)) = normalized_customer_email
          )
          or (
            normalized_customer_phone is not null
            and trim(customer.phone) = normalized_customer_phone
          )
        )
    ) into possible_duplicate;

    insert into public.customers (
      business_id,
      name,
      email,
      phone
    )
    values (
      current_business_id,
      normalized_customer_name,
      normalized_customer_email,
      normalized_customer_phone
    )
    returning id into selected_customer_id;

    did_create_customer := true;

    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      actor_user_id,
      current_business_id,
      'CUSTOMER_CREATED',
      jsonb_build_object(
        'customer_id', selected_customer_id,
        'possible_duplicate', possible_duplicate,
        'source', 'inline_booking'
      )
    );
  else
    raise exception 'invalid_customer_mode' using errcode = '22023';
  end if;

  insert into public.bookings (
    business_id,
    customer_id,
    title,
    description,
    currency,
    total_amount_minor,
    deposit_amount_minor,
    scheduled_for,
    internal_notes,
    created_by
  )
  values (
    current_business_id,
    selected_customer_id,
    trim(p_title),
    nullif(trim(p_description), ''),
    p_currency,
    p_total_amount_minor,
    p_deposit_amount_minor,
    p_scheduled_for,
    nullif(trim(p_internal_notes), ''),
    actor_user_id
  )
  returning id, bookings.reference, bookings.status
  into created_booking_id, created_booking_reference, created_booking_status;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    actor_user_id,
    current_business_id,
    'BOOKING_CREATED',
    jsonb_build_object('booking_id', created_booking_id)
  );

  return query
  select
    created_booking_id,
    selected_customer_id,
    did_create_customer,
    created_booking_reference,
    created_booking_status;
end;
$$;

revoke all on function public.create_booking_with_customer(
  uuid,
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
  uuid,
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
