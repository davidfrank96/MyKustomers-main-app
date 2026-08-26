create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  booking_id uuid not null,
  operation_id uuid not null,
  amount_minor bigint not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint booking_payments_business_booking_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_payments_amount_positive
    check (amount_minor > 0),
  constraint booking_payments_amount_safe_integer
    check (amount_minor <= 9007199254740991),
  constraint booking_payments_operation_unique
    unique (business_id, booking_id, operation_id)
);

alter table public.booking_payments owner to postgres;

create index booking_payments_business_booking_recorded_idx
on public.booking_payments (business_id, booking_id, recorded_at desc, id desc);

create index booking_payments_recorded_by_idx
on public.booking_payments (recorded_by);

alter table public.booking_payments enable row level security;

revoke all on table public.booking_payments from public, anon, authenticated;
grant select on table public.booking_payments to authenticated;
grant select, insert, update, delete on table public.booking_payments to service_role;

create policy "Members can read booking payments"
on public.booking_payments
for select
to authenticated
using (private.is_business_member(business_id));

create or replace function private.booking_payment_totals(
  p_business_id uuid,
  p_booking_id uuid
)
returns table (
  currency public.booking_currency,
  effective_total_amount_minor bigint,
  initial_deposit_amount_minor bigint,
  confirmed_addon_deposit_amount_minor bigint,
  subsequent_payment_amount_minor bigint,
  recorded_paid_amount_minor bigint,
  outstanding_amount_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with booking_scope as (
    select
      booking.currency,
      booking.total_amount_minor,
      booking.deposit_amount_minor
    from public.bookings as booking
    where booking.business_id = p_business_id
      and booking.id = p_booking_id
  ),
  addon_totals as (
    select
      coalesce(sum(addon.total_amount_minor), 0)::bigint as total_amount_minor,
      coalesce(sum(addon.deposit_amount_minor), 0)::bigint as deposit_amount_minor
    from public.booking_addons as addon
    where addon.business_id = p_business_id
      and addon.booking_id = p_booking_id
      and addon.status = 'CONFIRMED'
  ),
  payment_totals as (
    select coalesce(sum(payment.amount_minor), 0)::bigint as amount_minor
    from public.booking_payments as payment
    where payment.business_id = p_business_id
      and payment.booking_id = p_booking_id
  ),
  totals as (
    select
      booking.currency,
      (booking.total_amount_minor + addon.total_amount_minor)::bigint
        as effective_total_amount_minor,
      booking.deposit_amount_minor::bigint as initial_deposit_amount_minor,
      addon.deposit_amount_minor::bigint as confirmed_addon_deposit_amount_minor,
      payment.amount_minor::bigint as subsequent_payment_amount_minor,
      (
        booking.deposit_amount_minor
        + addon.deposit_amount_minor
        + payment.amount_minor
      )::bigint as recorded_paid_amount_minor
    from booking_scope as booking
    cross join addon_totals as addon
    cross join payment_totals as payment
  )
  select
    totals.currency,
    totals.effective_total_amount_minor,
    totals.initial_deposit_amount_minor,
    totals.confirmed_addon_deposit_amount_minor,
    totals.subsequent_payment_amount_minor,
    totals.recorded_paid_amount_minor,
    greatest(
      totals.effective_total_amount_minor - totals.recorded_paid_amount_minor,
      0
    )::bigint as outstanding_amount_minor
  from totals;
$$;

alter function private.booking_payment_totals(uuid, uuid) owner to postgres;
revoke all on function private.booking_payment_totals(uuid, uuid)
from public, anon, authenticated;

create or replace function public.get_booking_payment_summary(p_booking_id uuid)
returns table (
  currency public.booking_currency,
  effective_total_amount_minor bigint,
  initial_deposit_amount_minor bigint,
  confirmed_addon_deposit_amount_minor bigint,
  subsequent_payment_amount_minor bigint,
  recorded_paid_amount_minor bigint,
  outstanding_amount_minor bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_business_id uuid;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select booking.business_id
  into booking_business_id
  from public.bookings as booking
  where booking.id = p_booking_id;

  if booking_business_id is null
    or not private.is_business_member(booking_business_id)
  then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  return query
  select *
  from private.booking_payment_totals(booking_business_id, p_booking_id);
end;
$$;

alter function public.get_booking_payment_summary(uuid) owner to postgres;
revoke all on function public.get_booking_payment_summary(uuid)
from public, anon, authenticated;
grant execute on function public.get_booking_payment_summary(uuid) to authenticated;

create or replace function public.record_booking_payment(
  p_booking_id uuid,
  p_amount_minor bigint,
  p_operation_id uuid
)
returns table (
  payment_id uuid,
  recorded_paid_amount_minor bigint,
  outstanding_amount_minor bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  existing_payment public.booking_payments;
  payment_row public.booking_payments;
  totals record;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_operation_id is null then
    raise exception 'payment_operation_id_required'
      using errcode = '22023';
  end if;

  if p_amount_minor is null
    or p_amount_minor <= 0
    or p_amount_minor > 9007199254740991
  then
    raise exception 'payment_amount_invalid'
      using errcode = '22023';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  select payment.*
  into existing_payment
  from public.booking_payments as payment
  where payment.business_id = booking_row.business_id
    and payment.booking_id = booking_row.id
    and payment.operation_id = p_operation_id;

  if existing_payment.id is not null then
    if existing_payment.amount_minor is distinct from p_amount_minor
      or existing_payment.recorded_by is distinct from caller_user_id
    then
      raise exception 'payment_operation_conflict'
        using errcode = '23000';
    end if;

    select *
    into totals
    from private.booking_payment_totals(booking_row.business_id, booking_row.id);

    return query
    select existing_payment.id,
      totals.recorded_paid_amount_minor,
      totals.outstanding_amount_minor;
    return;
  end if;

  if booking_row.status not in ('IN_PROGRESS', 'READY', 'DELIVERED') then
    raise exception 'booking_not_eligible_for_payment_recording'
      using errcode = '23000';
  end if;

  select *
  into totals
  from private.booking_payment_totals(booking_row.business_id, booking_row.id);

  if totals.outstanding_amount_minor <= 0 then
    raise exception 'booking_balance_already_recorded'
      using errcode = '23514';
  end if;

  if p_amount_minor > totals.outstanding_amount_minor then
    raise exception 'payment_exceeds_outstanding_balance'
      using errcode = '23514';
  end if;

  insert into public.booking_payments (
    business_id,
    booking_id,
    operation_id,
    amount_minor,
    recorded_by
  )
  values (
    booking_row.business_id,
    booking_row.id,
    p_operation_id,
    p_amount_minor,
    caller_user_id
  )
  returning * into payment_row;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    'BOOKING_PAYMENT_RECORDED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'payment_id', payment_row.id,
      'amount_minor', payment_row.amount_minor,
      'currency', booking_row.currency
    )
  );

  select *
  into totals
  from private.booking_payment_totals(booking_row.business_id, booking_row.id);

  return query
  select payment_row.id,
    totals.recorded_paid_amount_minor,
    totals.outstanding_amount_minor;
end;
$$;

alter function public.record_booking_payment(uuid, bigint, uuid) owner to postgres;
revoke all on function public.record_booking_payment(uuid, bigint, uuid)
from public, anon, authenticated;
grant execute on function public.record_booking_payment(uuid, bigint, uuid)
to authenticated;

create or replace function private.enforce_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  material_changed boolean := false;
  requested_status_change boolean := false;
  transition_allowed boolean := false;
  reschedule_allowed boolean := false;
  amendment_allowed boolean := false;
  revoked_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  caller_user_id := auth.uid();
  transition_allowed := coalesce(
    current_setting('app.booking_transition_allowed', true),
    'false'
  ) = 'true';
  reschedule_allowed := coalesce(
    current_setting('app.booking_reschedule_allowed', true),
    'false'
  ) = 'true';
  amendment_allowed := coalesce(
    current_setting('app.booking_amendment_allowed', true),
    'false'
  ) = 'true';

  if tg_op = 'INSERT' then
    if caller_user_id is not null and new.created_by is distinct from caller_user_id then
      raise exception 'booking_created_by_must_match_authenticated_user'
        using errcode = '23000';
    end if;

    if caller_user_id is not null and new.status <> 'DRAFT' then
      raise exception 'booking_must_start_draft'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED' then
      raise exception 'booking_cannot_start_confirmed'
        using errcode = '23000';
    end if;

    if new.status in ('DRAFT', 'AWAITING_CUSTOMER', 'CONFIRMED') then
      new.started_at := null;
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'READY' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := coalesce(new.ready_at, v_now);
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'DELIVERED' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := coalesce(new.ready_at, v_now);
      new.delivered_at := coalesce(new.delivered_at, v_now);
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'COMPLETED' then
      new.started_at := coalesce(new.started_at, v_now);
      new.ready_at := coalesce(new.ready_at, v_now);
      new.delivered_at := coalesce(new.delivered_at, v_now);
      new.completed_at := coalesce(new.completed_at, v_now);
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(new.cancelled_at, v_now);
      new.completed_at := null;
      new.cancellation_reason := nullif(trim(coalesce(new.cancellation_reason, '')), '');
    end if;

    if new.status in ('DRAFT', 'AWAITING_CUSTOMER', 'CANCELLED') then
      new.customer_confirmed_at := null;
      new.confirmation_terms_hash := null;
      new.confirmation_terms_snapshot := null;
    end if;

    return new;
  end if;

  requested_status_change := old.status is distinct from new.status;
  material_changed := private.booking_material_terms_changed(old, new);

  if old.business_id is distinct from new.business_id then
    raise exception 'booking_business_id_immutable'
      using errcode = '23000';
  end if;

  if old.customer_id is distinct from new.customer_id then
    raise exception 'booking_customer_id_immutable'
      using errcode = '23000';
  end if;

  if old.reference is distinct from new.reference then
    raise exception 'booking_reference_immutable'
      using errcode = '23000';
  end if;

  if old.created_by is distinct from new.created_by then
    raise exception 'booking_created_by_immutable'
      using errcode = '23000';
  end if;

  if old.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'terminal_booking_locked'
      using errcode = '23000';
  end if;

  if requested_status_change and caller_user_id is not null and not transition_allowed then
    raise exception 'booking_status_transition_requires_controlled_operation'
      using errcode = '23000';
  end if;

  if old.scheduled_for is distinct from new.scheduled_for
    and old.status in ('AWAITING_CUSTOMER', 'CONFIRMED', 'IN_PROGRESS')
    and not reschedule_allowed
    and not amendment_allowed
  then
    raise exception 'booking_reschedule_requires_controlled_operation'
      using errcode = '23000';
  end if;

  if material_changed and old.status = 'CONFIRMED'
    and not amendment_allowed
    and not (
      reschedule_allowed
      and old.scheduled_for is distinct from new.scheduled_for
      and old.customer_id is not distinct from new.customer_id
      and old.title is not distinct from new.title
      and old.description is not distinct from new.description
      and old.currency is not distinct from new.currency
      and old.total_amount_minor is not distinct from new.total_amount_minor
      and old.deposit_amount_minor is not distinct from new.deposit_amount_minor
    )
  then
    raise exception 'customer_confirmed_material_terms_locked'
      using errcode = '23000';
  end if;

  if material_changed
    and old.status in ('IN_PROGRESS', 'READY', 'DELIVERED')
    and not (amendment_allowed and old.status = 'IN_PROGRESS')
    and not (
      reschedule_allowed
      and old.status = 'IN_PROGRESS'
      and old.scheduled_for is distinct from new.scheduled_for
      and old.customer_id is not distinct from new.customer_id
      and old.title is not distinct from new.title
      and old.description is not distinct from new.description
      and old.currency is not distinct from new.currency
      and old.total_amount_minor is not distinct from new.total_amount_minor
      and old.deposit_amount_minor is not distinct from new.deposit_amount_minor
    )
  then
    raise exception 'customer_confirmed_material_terms_locked'
      using errcode = '23000';
  end if;

  if amendment_allowed and old.status not in ('CONFIRMED', 'IN_PROGRESS') then
    raise exception 'booking_not_eligible_for_amendment'
      using errcode = '23000';
  end if;

  if material_changed and old.status = 'AWAITING_CUSTOMER' then
    revoked_count := private.revoke_open_confirmation_links(old.id, 'material_change');

    if revoked_count > 0 then
      insert into public.audit_logs (
        actor_user_id,
        business_id,
        event_type,
        metadata
      )
      values (
        caller_user_id,
        old.business_id,
        'BOOKING_CONFIRMATION_INVALIDATED',
        jsonb_build_object('booking_id', old.id, 'reason', 'material_change')
      );
    end if;
  end if;

  if material_changed
    and old.status in ('CONFIRMED', 'IN_PROGRESS')
    and not amendment_allowed
  then
    new.status := 'AWAITING_CUSTOMER';
    new.customer_confirmed_at := null;
    new.confirmation_terms_hash := null;
    new.confirmation_terms_snapshot := null;
    perform private.revoke_open_confirmation_links(old.id, 'material_change');
    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      caller_user_id,
      old.business_id,
      'BOOKING_CONFIRMATION_INVALIDATED',
      jsonb_build_object('booking_id', old.id, 'reason', 'material_change')
    );
  end if;

  if old.status is distinct from new.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('AWAITING_CUSTOMER', 'CANCELLED'))
      or (old.status = 'AWAITING_CUSTOMER' and new.status = 'CANCELLED')
      or (
        old.status = 'AWAITING_CUSTOMER'
        and new.status = 'CONFIRMED'
        and caller_user_id is null
      )
      or (
        old.status = 'CONFIRMED'
        and new.status in ('AWAITING_CUSTOMER', 'IN_PROGRESS', 'CANCELLED')
      )
      or (
        old.status = 'IN_PROGRESS'
        and new.status = 'AWAITING_CUSTOMER'
        and reschedule_allowed
      )
      or (old.status = 'IN_PROGRESS' and new.status in ('READY', 'CANCELLED'))
      or (old.status = 'READY' and new.status in ('DELIVERED', 'CANCELLED'))
      or (old.status = 'DELIVERED' and new.status = 'COMPLETED')
    ) then
      raise exception 'invalid_booking_status_transition'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED'
      and (
        new.customer_confirmed_at is null
        or new.confirmation_terms_hash is null
        or new.confirmation_terms_snapshot is null
      )
    then
      raise exception 'confirmed_booking_requires_terms_snapshot'
        using errcode = '23000';
    end if;

    if new.status = 'IN_PROGRESS' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'READY' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := coalesce(old.ready_at, v_now);
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'DELIVERED' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := coalesce(old.ready_at, v_now);
      new.delivered_at := coalesce(old.delivered_at, v_now);
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'COMPLETED' then
      new.started_at := coalesce(old.started_at, v_now);
      new.ready_at := coalesce(old.ready_at, v_now);
      new.delivered_at := coalesce(old.delivered_at, v_now);
      new.completed_at := coalesce(old.completed_at, v_now);
      new.cancelled_at := null;
      new.cancellation_reason := null;
    elsif new.status = 'CANCELLED' then
      new.cancelled_at := coalesce(old.cancelled_at, v_now);
      new.completed_at := null;
      new.cancellation_reason := nullif(trim(coalesce(new.cancellation_reason, '')), '');
      perform private.revoke_open_confirmation_links(old.id, 'booking_cancelled');
    else
      new.started_at := null;
      new.ready_at := null;
      new.delivered_at := null;
      new.completed_at := null;
      new.cancelled_at := null;
      new.cancellation_reason := null;
    end if;
  else
    if old.started_at is distinct from new.started_at
      or old.ready_at is distinct from new.ready_at
      or old.delivered_at is distinct from new.delivered_at
      or old.cancelled_at is distinct from new.cancelled_at
      or old.completed_at is distinct from new.completed_at
      or old.cancellation_reason is distinct from new.cancellation_reason
    then
      raise exception 'operational_timestamps_follow_status'
        using errcode = '23000';
    end if;

    if not amendment_allowed
      and (
        old.customer_confirmed_at is distinct from new.customer_confirmed_at
        or old.confirmation_terms_hash is distinct from new.confirmation_terms_hash
        or old.confirmation_terms_snapshot is distinct from new.confirmation_terms_snapshot
      )
    then
      raise exception 'confirmation_terms_follow_status'
        using errcode = '23000';
    end if;
  end if;

  return new;
end;
$$;

alter function private.enforce_booking_integrity() owner to postgres;
revoke all on function private.enforce_booking_integrity()
from public, anon, authenticated;

create or replace function private.record_booking_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed_at timestamptz := clock_timestamp();
begin
  select greatest(
    v_changed_at,
    coalesce(max(history.changed_at) + interval '1 microsecond', v_changed_at)
  )
  into v_changed_at
  from public.booking_status_history as history
  where history.business_id = new.business_id
    and history.booking_id = new.id;

  if tg_op = 'INSERT' then
    insert into public.booking_status_history (
      booking_id,
      business_id,
      from_status,
      to_status,
      changed_by,
      changed_at
    )
    values (
      new.id,
      new.business_id,
      null,
      new.status,
      auth.uid(),
      v_changed_at
    );
  elsif old.status is distinct from new.status then
    insert into public.booking_status_history (
      booking_id,
      business_id,
      from_status,
      to_status,
      changed_by,
      changed_at
    )
    values (
      new.id,
      new.business_id,
      old.status,
      new.status,
      auth.uid(),
      v_changed_at
    );
  end if;

  return new;
end;
$$;

alter function private.record_booking_status_history() owner to postgres;
revoke all on function private.record_booking_status_history()
from public, anon, authenticated;

create or replace function public.confirm_booking_by_token_hash(
  p_token_hash text,
  p_contact_email text,
  p_contact_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.confirmation_links;
  booking_row public.bookings;
  customer_row public.customers;
  business_row public.businesses;
  snapshot jsonb;
  terms_hash text;
  normalized_contact_email text := lower(trim(p_contact_email));
  normalized_contact_phone text := nullif(trim(p_contact_phone), '');
  confirmation_id uuid;
  email_event_id uuid;
  confirmed_time timestamptz := clock_timestamp();
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if normalized_contact_email is null
    or char_length(normalized_contact_email) > 254
    or normalized_contact_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    return jsonb_build_object('status', 'invalid_contact');
  end if;

  if normalized_contact_phone is not null
    and (
      char_length(normalized_contact_phone) not between 7 and 32
      or normalized_contact_phone !~ '^[0-9+().[:space:]-]+$'
    )
  then
    return jsonb_build_object('status', 'invalid_contact');
  end if;

  select link.*
  into link_row
  from public.confirmation_links as link
  where link.token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = link_row.booking_id
    and booking.business_id = link_row.business_id
  for update;

  if not found or booking_row.status in ('CANCELLED', 'COMPLETED') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.used_at is not null then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'business_id', link_row.business_id,
      'booking_id', link_row.booking_id
    );
  end if;

  if link_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= confirmed_time then
    return jsonb_build_object('status', 'expired');
  end if;

  if booking_row.status <> 'AWAITING_CUSTOMER' then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  select customer.*
  into customer_row
  from public.customers as customer
  where customer.id = booking_row.customer_id
    and customer.business_id = booking_row.business_id
  for update;

  select business.*
  into business_row
  from public.businesses as business
  where business.id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);
  terms_hash := private.booking_terms_hash(snapshot);

  update public.customers as customer
  set email = case
        when nullif(trim(customer_row.email), '') is null then normalized_contact_email
        else customer_row.email
      end,
      phone = case
        when normalized_contact_phone is not null
          and nullif(trim(customer_row.phone), '') is null
          then normalized_contact_phone
        else customer_row.phone
      end
  where customer.id = customer_row.id
    and (
      nullif(trim(customer_row.email), '') is null
      or (
        normalized_contact_phone is not null
        and nullif(trim(customer_row.phone), '') is null
      )
    );

  update public.bookings as booking
  set status = 'CONFIRMED',
      customer_confirmed_at = confirmed_time,
      confirmation_terms_hash = terms_hash,
      confirmation_terms_snapshot = snapshot
  where booking.id = booking_row.id;

  update public.confirmation_links as link
  set used_at = confirmed_time
  where link.id = link_row.id;

  insert into public.booking_confirmations (
    business_id,
    booking_id,
    confirmation_link_id,
    terms_hash,
    terms_snapshot,
    contact_email,
    contact_phone,
    confirmed_at
  )
  values (
    booking_row.business_id,
    booking_row.id,
    link_row.id,
    terms_hash,
    snapshot,
    normalized_contact_email,
    normalized_contact_phone,
    confirmed_time
  )
  returning id into confirmation_id;

  insert into public.email_events (
    business_id,
    booking_id,
    customer_id,
    booking_confirmation_id,
    event_type,
    recipient_email
  )
  values (
    booking_row.business_id,
    booking_row.id,
    booking_row.customer_id,
    confirmation_id,
    'BOOKING_CONFIRMED',
    normalized_contact_email
  )
  returning id into email_event_id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    booking_row.business_id,
    'BOOKING_CONFIRMED_BY_CUSTOMER',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_link_id', link_row.id,
      'terms_hash', terms_hash,
      'confirmation_id', confirmation_id,
      'email_event_id', email_event_id,
      'contact_captured', true,
      'phone_provided', normalized_contact_phone is not null,
      'operational_status', 'IN_PROGRESS'
    )
  );

  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings as booking
  set status = 'IN_PROGRESS'
  where booking.id = booking_row.id
    and booking.status = 'CONFIRMED';

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    booking_row.business_id,
    'BOOKING_STATUS_CHANGED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'from_status', 'CONFIRMED',
      'to_status', 'IN_PROGRESS',
      'automatic_after_confirmation', true
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'confirmed_at', confirmed_time,
    'terms_hash', terms_hash,
    'email_event_id', email_event_id,
    'operational_status', 'IN_PROGRESS'
  );
end;
$$;

alter function public.confirm_booking_by_token_hash(text, text, text)
owner to postgres;
revoke all on function public.confirm_booking_by_token_hash(text, text, text)
from public, anon, authenticated;
grant execute on function public.confirm_booking_by_token_hash(text, text, text)
to service_role;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_scheduled_for timestamptz
)
returns table (
  booking_id uuid,
  previous_scheduled_for timestamptz,
  new_scheduled_for timestamptz,
  status public.booking_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  updated_row public.bookings;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_scheduled_for is null or p_scheduled_for <= now() then
    raise exception 'scheduled_for_must_be_future'
      using errcode = '22023';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status not in (
    'DRAFT',
    'AWAITING_CUSTOMER',
    'CONFIRMED',
    'IN_PROGRESS'
  ) then
    raise exception 'booking_not_eligible_for_reschedule'
      using errcode = '23000';
  end if;

  if booking_row.scheduled_for is not distinct from p_scheduled_for then
    raise exception 'booking_schedule_unchanged'
      using errcode = '22023';
  end if;

  perform set_config('app.booking_reschedule_allowed', 'true', true);

  update public.bookings as booking
  set scheduled_for = p_scheduled_for
  where booking.id = booking_row.id
  returning booking.* into updated_row;

  perform private.revoke_pending_booking_amendments(
    booking_row.id,
    'booking_rescheduled',
    caller_user_id
  );

  insert into public.booking_changes (
    business_id,
    booking_id,
    changed_by,
    change_type,
    previous_scheduled_for,
    new_scheduled_for
  )
  values (
    booking_row.business_id,
    booking_row.id,
    caller_user_id,
    'reschedule',
    booking_row.scheduled_for,
    p_scheduled_for
  );

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    'BOOKING_RESCHEDULED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'previous_scheduled_for', booking_row.scheduled_for,
      'new_scheduled_for', p_scheduled_for,
      'confirmation_invalidated',
        booking_row.status in ('CONFIRMED', 'IN_PROGRESS')
    )
  );

  return query
  select
    updated_row.id,
    booking_row.scheduled_for,
    updated_row.scheduled_for,
    updated_row.status;
end;
$$;

alter function public.reschedule_booking(uuid, timestamptz) owner to postgres;
revoke all on function public.reschedule_booking(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz)
to authenticated;

create or replace function public.transition_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_cancellation_reason text default null
)
returns table (
  booking_id uuid,
  from_status public.booking_status,
  to_status public.booking_status,
  changed_at timestamptz,
  email_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  booking_row public.bookings;
  updated_row public.bookings;
  confirmation_row public.booking_confirmations;
  payment_totals record;
  clean_reason text;
  notification_recipient text;
  created_email_event_id uuid;
  v_changed_at timestamptz := clock_timestamp();
  audit_type public.audit_event_type;
begin
  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select booking.*
  into booking_row
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status = p_to_status then
    raise exception 'booking_already_in_target_status'
      using errcode = '23000';
  end if;

  clean_reason := nullif(trim(coalesce(p_cancellation_reason, '')), '');

  if p_to_status = 'CANCELLED'
    and clean_reason is not null
    and char_length(clean_reason) > 500
  then
    raise exception 'cancellation_reason_too_long'
      using errcode = '22023';
  end if;

  if p_to_status = 'CANCELLED'
    and clean_reason ~* '<[[:space:]]*/?[[:space:]]*[a-z][^>]*>'
  then
    raise exception 'cancellation_reason_must_be_plain_text'
      using errcode = '22023';
  end if;

  if p_to_status = 'CANCELLED'
    and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    and clean_reason is null
  then
    raise exception 'cancellation_reason_required'
      using errcode = '22023';
  end if;

  if p_to_status <> 'CANCELLED' and clean_reason is not null then
    raise exception 'cancellation_reason_only_allowed_for_cancellation'
      using errcode = '22023';
  end if;

  if booking_row.status = 'DELIVERED' and p_to_status = 'COMPLETED' then
    select *
    into payment_totals
    from private.booking_payment_totals(booking_row.business_id, booking_row.id);

    if payment_totals.outstanding_amount_minor > 0 then
      raise exception 'outstanding_balance'
        using errcode = '23514';
    end if;
  end if;

  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings as booking
  set status = p_to_status,
      cancellation_reason = case
        when p_to_status = 'CANCELLED' then clean_reason
        else null
      end
  where booking.id = booking_row.id
  returning booking.* into updated_row;

  if p_to_status in ('READY', 'CANCELLED') then
    perform private.revoke_pending_booking_amendments(
      booking_row.id,
      case
        when p_to_status = 'CANCELLED' then 'booking_cancelled'
        else 'booking_advanced'
      end,
      caller_user_id
    );
  end if;

  if (
    p_to_status = 'DELIVERED'
    or (
      p_to_status = 'CANCELLED'
      and booking_row.status in ('CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED')
    )
  ) then
    select confirmation.*
    into confirmation_row
    from public.booking_confirmations as confirmation
    where confirmation.business_id = booking_row.business_id
      and confirmation.booking_id = booking_row.id
    order by confirmation.confirmed_at desc, confirmation.id desc
    limit 1;

    notification_recipient := confirmation_row.contact_email;

    if notification_recipient is null then
      select lower(trim(customer.email))
      into notification_recipient
      from public.customers as customer
      where customer.business_id = booking_row.business_id
        and customer.id = booking_row.customer_id;
    end if;

    if confirmation_row.id is not null and notification_recipient is not null then
      insert into public.email_events (
        business_id,
        booking_id,
        customer_id,
        booking_confirmation_id,
        event_type,
        recipient_email
      )
      values (
        booking_row.business_id,
        booking_row.id,
        booking_row.customer_id,
        confirmation_row.id,
        case
          when p_to_status = 'DELIVERED'
            then 'BOOKING_DELIVERED'::public.email_event_type
          else 'BOOKING_CANCELLED'::public.email_event_type
        end,
        notification_recipient
      )
      on conflict (booking_confirmation_id, event_type) do nothing
      returning id into created_email_event_id;

      if created_email_event_id is null then
        select event.id
        into created_email_event_id
        from public.email_events as event
        where event.booking_confirmation_id = confirmation_row.id
          and event.event_type = case
            when p_to_status = 'DELIVERED'
              then 'BOOKING_DELIVERED'::public.email_event_type
            else 'BOOKING_CANCELLED'::public.email_event_type
          end;
      end if;
    end if;
  end if;

  audit_type := case
    when p_to_status = 'CANCELLED'
      then 'BOOKING_CANCELLED'::public.audit_event_type
    when p_to_status = 'COMPLETED'
      then 'BOOKING_COMPLETED'::public.audit_event_type
    else 'BOOKING_STATUS_CHANGED'::public.audit_event_type
  end;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    audit_type,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'from_status', booking_row.status,
      'to_status', p_to_status,
      'cancellation_reason_provided', clean_reason is not null,
      'email_event_created', created_email_event_id is not null
    )
  );

  return query
  select
    updated_row.id,
    booking_row.status,
    updated_row.status,
    v_changed_at,
    created_email_event_id;
end;
$$;

alter function public.transition_booking_status(
  uuid,
  public.booking_status,
  text
) owner to postgres;
revoke all on function public.transition_booking_status(
  uuid,
  public.booking_status,
  text
) from public, anon, authenticated;
grant execute on function public.transition_booking_status(
  uuid,
  public.booking_status,
  text
) to authenticated;

notify pgrst, 'reload schema';
