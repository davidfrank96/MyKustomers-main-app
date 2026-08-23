create or replace function private.enforce_booking_addon_parent_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_currency public.booking_currency;
begin
  select booking.currency
  into parent_currency
  from public.bookings as booking
  where booking.id = new.booking_id
    and booking.business_id = new.business_id;

  if not found then
    raise exception 'booking_addon_parent_mismatch'
      using errcode = '23503';
  end if;

  if new.currency is distinct from parent_currency then
    raise exception 'booking_addon_currency_mismatch'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

create trigger booking_addons_enforce_parent_consistency
before insert or update of business_id, booking_id, currency on public.booking_addons
for each row execute function private.enforce_booking_addon_parent_consistency();

revoke all on function private.enforce_booking_addon_parent_consistency()
from public, anon, authenticated;

notify pgrst, 'reload schema';
