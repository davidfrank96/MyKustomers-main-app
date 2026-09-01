begin;

-- FORWARD TIGHTENING MIGRATION — PREPARED, NOT APPLIED.
--
-- The cutoff is the Production application deployment convergence point for
-- merge commit 1dd7aede821e07fabdd50cb9857ea83b208ff633. Historical legacy
-- delivery events created before this point remain grandfathered because the
-- constraint triggers below evaluate only future INSERT/UPDATE transitions.
do $function$
begin
  if exists (
    select 1
    from public.email_events as event
    left join public.feedback_links as feedback_link
      on feedback_link.id = event.feedback_link_id
      and feedback_link.business_id = event.business_id
      and feedback_link.booking_id = event.booking_id
    where event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
      and event.created_at >= timestamptz '2026-09-01 22:21:08+00'
      and (
        event.feedback_link_id is null
        or feedback_link.id is null
        or feedback_link.token_version <> 1
        or feedback_link.purpose <> 'booking_feedback'
      )
  ) then
    raise exception 'delivery_feedback_tightening_precondition_failed'
      using errcode = '23514';
  end if;
end;
$function$;

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

  if v_event.feedback_link_id is null then
    raise exception 'new_delivery_event_requires_feedback_capability'
      using errcode = '23514';
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
revoke all on function private.enforce_delivery_event_feedback_association()
from public, anon, authenticated, service_role;

create or replace function private.enforce_new_delivery_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.email_events as event
    join public.feedback_links as feedback_link
      on feedback_link.id = event.feedback_link_id
      and feedback_link.business_id = event.business_id
      and feedback_link.booking_id = event.booking_id
    where event.business_id = new.business_id
      and event.booking_id = new.id
      and event.event_type = 'BOOKING_DELIVERED'::public.email_event_type
      and feedback_link.token_version = 1
      and feedback_link.purpose = 'booking_feedback'
  ) then
    raise exception 'delivery_transition_requires_feedback_event_association'
      using errcode = '23514';
  end if;

  return null;
end;
$function$;

alter function private.enforce_new_delivery_transaction() owner to postgres;
revoke all on function private.enforce_new_delivery_transaction()
from public, anon, authenticated, service_role;

comment on function private.enforce_delivery_event_feedback_association()
is 'Strict boundary: every new delivery email event requires an immutable same-tenant booking_feedback version-1 capability association.';

comment on function private.enforce_new_delivery_transaction()
is 'Strict boundary: every future READY to DELIVERED transition requires a same-tenant booking_feedback version-1 delivery event association.';

notify pgrst, 'reload schema';

commit;
