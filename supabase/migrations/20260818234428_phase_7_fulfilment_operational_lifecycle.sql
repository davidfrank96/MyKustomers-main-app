alter type public.audit_event_type add value if not exists 'BOOKING_RESCHEDULED';

alter table public.bookings
  add column if not exists started_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancellation_reason text;

update public.bookings
set started_at = coalesce(started_at, updated_at)
where status in ('IN_PROGRESS', 'READY', 'DELIVERED', 'COMPLETED')
  and started_at is null;

update public.bookings
set ready_at = coalesce(ready_at, started_at, updated_at)
where status in ('READY', 'DELIVERED', 'COMPLETED')
  and ready_at is null;

update public.bookings
set delivered_at = coalesce(delivered_at, ready_at, started_at, updated_at)
where status in ('DELIVERED', 'COMPLETED')
  and delivered_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_cancellation_reason_length'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_cancellation_reason_length
      check (cancellation_reason is null or char_length(cancellation_reason) <= 500);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_started_timestamp_consistent'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_started_timestamp_consistent
      check (
        (status not in ('IN_PROGRESS', 'READY', 'DELIVERED', 'COMPLETED') or started_at is not null)
        and (started_at is null or started_at >= created_at)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_ready_timestamp_consistent'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_ready_timestamp_consistent
      check (
        (status not in ('READY', 'DELIVERED', 'COMPLETED') or ready_at is not null)
        and (ready_at is null or started_at is null or ready_at >= started_at)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_delivered_timestamp_consistent'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_delivered_timestamp_consistent
      check (
        (status not in ('DELIVERED', 'COMPLETED') or delivered_at is not null)
        and (delivered_at is null or ready_at is null or delivered_at >= ready_at)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_completed_not_before_delivered'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_completed_not_before_delivered
      check (completed_at is null or delivered_at is null or completed_at >= delivered_at);
  end if;
end $$;

create table if not exists public.booking_changes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  changed_by uuid references auth.users(id) on delete set null,
  change_type text not null,
  previous_scheduled_for timestamptz,
  new_scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_changes_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_changes_type_check check (change_type = 'reschedule'),
  constraint booking_changes_reschedule_changed check (
    previous_scheduled_for is distinct from new_scheduled_for
  )
);

create index if not exists booking_changes_booking_idx
on public.booking_changes (business_id, booking_id, created_at desc);

create index if not exists bookings_business_operational_idx
on public.bookings (business_id, status, scheduled_for)
where status not in ('COMPLETED', 'CANCELLED');

create or replace function private.enforce_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  material_changed boolean := false;
  requested_status_change boolean := false;
  transition_allowed boolean := false;
  reschedule_allowed boolean := false;
  v_now timestamptz := now();
begin
  caller_user_id := auth.uid();
  transition_allowed := coalesce(current_setting('app.booking_transition_allowed', true), 'false') = 'true';
  reschedule_allowed := coalesce(current_setting('app.booking_reschedule_allowed', true), 'false') = 'true';

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
    and old.status in ('AWAITING_CUSTOMER', 'CONFIRMED')
    and not reschedule_allowed
  then
    raise exception 'booking_reschedule_requires_controlled_operation'
      using errcode = '23000';
  end if;

  if material_changed and old.status in ('IN_PROGRESS', 'READY', 'DELIVERED') then
    raise exception 'material_changes_not_allowed_after_work_started'
      using errcode = '23000';
  end if;

  if material_changed and old.status = 'CONFIRMED' then
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
      or (old.status = 'AWAITING_CUSTOMER' and new.status = 'CONFIRMED' and caller_user_id is null)
      or (old.status = 'CONFIRMED' and new.status in ('AWAITING_CUSTOMER', 'IN_PROGRESS', 'CANCELLED'))
      or (old.status = 'IN_PROGRESS' and new.status in ('READY', 'CANCELLED'))
      or (old.status = 'READY' and new.status in ('DELIVERED', 'CANCELLED'))
      or (old.status = 'DELIVERED' and new.status = 'COMPLETED')
    ) then
      raise exception 'invalid_booking_status_transition'
        using errcode = '23000';
    end if;

    if new.status = 'CONFIRMED'
      and (new.customer_confirmed_at is null or new.confirmation_terms_hash is null or new.confirmation_terms_snapshot is null)
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

    if old.customer_confirmed_at is distinct from new.customer_confirmed_at
      or old.confirmation_terms_hash is distinct from new.confirmation_terms_hash
      or old.confirmation_terms_snapshot is distinct from new.confirmation_terms_snapshot
    then
      raise exception 'confirmation_terms_follow_status'
        using errcode = '23000';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.create_booking_confirmation_link(
  p_booking_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '24 hours'
)
returns table (
  confirmation_link_id uuid,
  expires_at timestamptz,
  replaced_link_count integer
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  revoked_count integer;
  inserted_link_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() then
    raise exception 'confirmation_link_expiration_must_be_future'
      using errcode = '22023';
  end if;

  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status not in ('DRAFT', 'AWAITING_CUSTOMER') then
    raise exception 'booking_not_eligible_for_confirmation_link'
      using errcode = '23000';
  end if;

  revoked_count := private.revoke_open_confirmation_links(booking_row.id, 'regenerated');

  if booking_row.status = 'DRAFT' then
    perform set_config('app.booking_transition_allowed', 'true', true);
    update public.bookings
    set status = 'AWAITING_CUSTOMER'
    where id = booking_row.id;
  end if;

  insert into public.confirmation_links (
    business_id,
    booking_id,
    token_hash,
    expires_at,
    created_by
  )
  values (
    booking_row.business_id,
    booking_row.id,
    p_token_hash,
    p_expires_at,
    caller_user_id
  )
  returning id into inserted_link_id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    case when revoked_count > 0 then 'CONFIRMATION_LINK_REGENERATED'::public.audit_event_type else 'CONFIRMATION_LINK_CREATED'::public.audit_event_type end,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_link_id', inserted_link_id,
      'expires_at', p_expires_at,
      'replaced_link_count', revoked_count
    )
  );

  return query select inserted_link_id, p_expires_at, revoked_count;
end;
$$;

create or replace function public.transition_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_cancellation_reason text default null
)
returns table (
  booking_id uuid,
  from_status public.booking_status,
  to_status public.booking_status,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  updated_row public.bookings;
  clean_reason text;
  v_changed_at timestamptz := now();
  audit_type public.audit_event_type;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
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

  if p_to_status = 'CANCELLED' and clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'cancellation_reason_too_long'
      using errcode = '22023';
  end if;

  if p_to_status <> 'CANCELLED' and clean_reason is not null then
    raise exception 'cancellation_reason_only_allowed_for_cancellation'
      using errcode = '22023';
  end if;

  perform set_config('app.booking_transition_allowed', 'true', true);

  update public.bookings
  set status = p_to_status,
      cancellation_reason = case when p_to_status = 'CANCELLED' then clean_reason else null end
  where id = booking_row.id
  returning * into updated_row;

  audit_type := case
    when p_to_status = 'CANCELLED' then 'BOOKING_CANCELLED'::public.audit_event_type
    when p_to_status = 'COMPLETED' then 'BOOKING_COMPLETED'::public.audit_event_type
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
      'cancellation_reason_provided', clean_reason is not null
    )
  );

  return query select updated_row.id, booking_row.status, updated_row.status, v_changed_at;
end;
$$;

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
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  updated_row public.bookings;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_scheduled_for is null or p_scheduled_for <= now() then
    raise exception 'scheduled_for_must_be_future'
      using errcode = '22023';
  end if;

  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status not in ('DRAFT', 'AWAITING_CUSTOMER', 'CONFIRMED') then
    raise exception 'booking_not_eligible_for_reschedule'
      using errcode = '23000';
  end if;

  if booking_row.scheduled_for is not distinct from p_scheduled_for then
    raise exception 'booking_schedule_unchanged'
      using errcode = '22023';
  end if;

  perform set_config('app.booking_reschedule_allowed', 'true', true);

  update public.bookings
  set scheduled_for = p_scheduled_for
  where id = booking_row.id
  returning * into updated_row;

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
      'confirmation_invalidated', booking_row.status = 'CONFIRMED'
    )
  );

  return query select updated_row.id, booking_row.scheduled_for, updated_row.scheduled_for, updated_row.status;
end;
$$;

drop trigger if exists bookings_enforce_integrity on public.bookings;
create trigger bookings_enforce_integrity
before insert or update on public.bookings
for each row execute function private.enforce_booking_integrity();

alter table public.booking_changes enable row level security;

revoke all on public.booking_changes from anon, authenticated;
grant select on public.booking_changes to authenticated;
grant select, insert, update, delete on public.booking_changes to service_role;

revoke all on function private.enforce_booking_integrity() from public, anon, authenticated;
revoke all on function public.create_booking_confirmation_link(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.transition_booking_status(uuid, public.booking_status, text) from public, anon, authenticated;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.create_booking_confirmation_link(uuid, text, timestamptz) to authenticated;
grant execute on function public.transition_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;

drop policy if exists "Members can read booking changes" on public.booking_changes;
create policy "Members can read booking changes"
on public.booking_changes
for select
to authenticated
using (private.is_business_member(business_id));

notify pgrst, 'reload schema';
