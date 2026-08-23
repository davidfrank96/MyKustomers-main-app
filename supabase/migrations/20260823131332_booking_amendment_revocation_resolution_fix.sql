create or replace function private.revoke_pending_booking_amendments(
  target_booking_id uuid,
  reason text,
  actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  amendment_row public.booking_amendments;
  revoked_count integer := 0;
  v_reason text;
  v_actor_user_id uuid;
begin
  v_reason := reason;
  v_actor_user_id := actor_user_id;

  for amendment_row in
    update public.booking_amendments as amendment
    set status = 'REVOKED',
        revoked_at = now(),
        revoked_reason = left(v_reason, 80)
    where amendment.booking_id = target_booking_id
      and amendment.status = 'PENDING_CUSTOMER'
    returning amendment.*
  loop
    revoked_count := revoked_count + 1;

    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      v_actor_user_id,
      amendment_row.business_id,
      'BOOKING_AMENDMENT_REVOKED',
      jsonb_build_object(
        'booking_id', amendment_row.booking_id,
        'amendment_id', amendment_row.id,
        'reason', left(v_reason, 80)
      )
    );
  end loop;

  return revoked_count;
end;
$$;

revoke all on function private.revoke_pending_booking_amendments(uuid, text, uuid)
from public, anon, authenticated;
