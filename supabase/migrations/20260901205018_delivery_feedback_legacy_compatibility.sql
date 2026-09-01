begin;

-- Temporary compatibility boundary:
-- allow the currently deployed transition_booking_status() path to produce its
-- historical BOOKING_DELIVERED event without a feedback association.
--
-- When an association is present, all version-1 tenant, purpose, hash, FK, and
-- immutability protections remain enforced.
create or replace function private.enforce_delivery_event_feedback_association()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.email_events;
  v_link public.feedback_links;
begin
  if tg_op = 'UPDATE'
    and old.feedback_link_id is not null
    and new.feedback_link_id is distinct from old.feedback_link_id
  then
    raise exception 'delivery_feedback_association_immutable'
      using errcode = '23000';
  end if;

  select event.*
  into v_event
  from public.email_events as event
  where event.id = new.id;

  if not found then
    return null;
  end if;

  if v_event.event_type <> 'BOOKING_DELIVERED'::public.email_event_type then
    if v_event.feedback_link_id is not null then
      raise exception 'feedback_link_only_allowed_for_delivery_event'
        using errcode = '23000';
    end if;

    return null;
  end if;

  -- Temporary legacy compatibility. The deployed delivery RPC creates this
  -- event without a feedback capability.
  if v_event.feedback_link_id is null then
    return null;
  end if;

  select feedback_link.*
  into v_link
  from public.feedback_links as feedback_link
  where feedback_link.id = v_event.feedback_link_id
    and feedback_link.business_id = v_event.business_id
    and feedback_link.booking_id = v_event.booking_id;

  if not found
    or v_link.token_version <> 1
    or v_link.purpose <> 'booking_feedback'
  then
    raise exception 'delivery_event_feedback_capability_invalid'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

alter function private.enforce_delivery_event_feedback_association()
  owner to postgres;

revoke all
on function private.enforce_delivery_event_feedback_association()
from public, anon, authenticated, service_role;

-- Preserve the requirement that READY -> DELIVERED creates exactly one durable
-- delivery event. Temporarily accept either:
--   1. the deployed legacy event with no association, or
--   2. the new event with a valid version-1 association.
create or replace function private.enforce_new_delivery_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_delivery_event_count bigint;
  v_delivery_event public.email_events;
begin
  select count(*)
  into v_delivery_event_count
  from public.email_events as event
  where event.business_id = new.business_id
    and event.booking_id = new.id
    and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type;

  if v_delivery_event_count <> 1 then
    raise exception 'delivery_transition_requires_feedback_event_association'
      using errcode = '23514';
  end if;

  select event.*
  into strict v_delivery_event
  from public.email_events as event
  where event.business_id = new.business_id
    and event.booking_id = new.id
    and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type;

  -- Temporary compatibility for transition_booking_status().
  if v_delivery_event.feedback_link_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.feedback_links as feedback_link
    where feedback_link.id = v_delivery_event.feedback_link_id
      and feedback_link.business_id = v_delivery_event.business_id
      and feedback_link.booking_id = v_delivery_event.booking_id
      and feedback_link.token_version = 1
      and feedback_link.purpose = 'booking_feedback'
  ) then
    raise exception 'delivery_transition_requires_feedback_event_association'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

alter function private.enforce_new_delivery_transaction()
  owner to postgres;

revoke all
on function private.enforce_new_delivery_transaction()
from public, anon, authenticated, service_role;

comment on function private.enforce_delivery_event_feedback_association()
is 'Temporary deployed-application compatibility: null delivery associations are allowed until all Production instances use deliver_booking_with_feedback(). Non-null associations retain strict v1 validation.';

comment on function private.enforce_new_delivery_transaction()
is 'Temporary deployed-application compatibility: READY to DELIVERED requires exactly one delivery event; legacy null association or a valid v1 association is accepted until application rollout completes.';

notify pgrst, 'reload schema';

commit;
