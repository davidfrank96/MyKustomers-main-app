alter type public.audit_event_type add value if not exists 'CONFIRMATION_SHARE_INITIATED';
alter type public.audit_event_type add value if not exists 'CONFIRMATION_OPENED';

alter table public.confirmation_links
  add column if not exists first_opened_at timestamptz;

create or replace function public.record_confirmation_link_open(
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

  update public.confirmation_links as confirmation_link
  set first_opened_at = now()
  from public.bookings as booking
  where confirmation_link.token_hash = p_token_hash
    and confirmation_link.first_opened_at is null
    and confirmation_link.revoked_at is null
    and confirmation_link.used_at is null
    and confirmation_link.expires_at > now()
    and booking.id = confirmation_link.booking_id
    and booking.business_id = confirmation_link.business_id
    and booking.status = 'AWAITING_CUSTOMER'
  returning
    confirmation_link.id,
    confirmation_link.booking_id,
    confirmation_link.business_id,
    confirmation_link.first_opened_at
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
    'CONFIRMATION_OPENED',
    jsonb_build_object(
      'booking_id', opened_booking_id,
      'confirmation_link_id', opened_link_id,
      'opened_at', opened_at
    )
  );

  return true;
end;
$$;

revoke all on function public.record_confirmation_link_open(text)
from public, anon, authenticated;
grant execute on function public.record_confirmation_link_open(text) to service_role;
