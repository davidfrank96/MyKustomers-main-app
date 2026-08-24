alter type public.audit_event_type add value if not exists 'FEEDBACK_SHARE_INITIATED';
alter type public.audit_event_type add value if not exists 'FEEDBACK_OPENED';

alter table public.feedback_links
  add column if not exists first_opened_at timestamptz;

create or replace function public.record_feedback_link_open(
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  opened_link_id uuid;
  opened_booking_id uuid;
  opened_business_id uuid;
  opened_at timestamptz;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  update public.feedback_links as feedback_link
  set first_opened_at = now()
  from public.bookings as booking
  where feedback_link.token_hash = p_token_hash
    and feedback_link.purpose = 'booking_feedback'
    and feedback_link.first_opened_at is null
    and feedback_link.revoked_at is null
    and feedback_link.used_at is null
    and feedback_link.expires_at > now()
    and booking.id = feedback_link.booking_id
    and booking.business_id = feedback_link.business_id
    and booking.status = 'COMPLETED'
  returning
    feedback_link.id,
    feedback_link.booking_id,
    feedback_link.business_id,
    feedback_link.first_opened_at
  into opened_link_id, opened_booking_id, opened_business_id, opened_at;

  if opened_link_id is null then
    return false;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    opened_business_id,
    'FEEDBACK_OPENED',
    jsonb_build_object(
      'booking_id', opened_booking_id,
      'feedback_link_id', opened_link_id,
      'opened_at', opened_at
    )
  );

  return true;
end;
$$;

revoke all on function public.record_feedback_link_open(text)
from public, anon, authenticated;
grant execute on function public.record_feedback_link_open(text) to service_role;
