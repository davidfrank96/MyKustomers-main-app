alter table public.email_events
  drop constraint email_events_addon_confirm_unique;

create unique index email_events_addon_confirm_unique
on public.email_events (booking_addon_id, event_type)
where event_type = 'BOOKING_ADDON_CONFIRMED';

do $migration$
declare
  function_sql text;
  original_function_sql text;
begin
  select pg_get_functiondef(
    'public.confirm_booking_addon_by_token_hash(text)'::regprocedure
  ) into function_sql;

  original_function_sql := function_sql;
  function_sql := replace(
    function_sql,
    'on conflict (booking_addon_id, event_type) do nothing',
    'on conflict (booking_addon_id, event_type) where event_type = ''BOOKING_ADDON_CONFIRMED'' do nothing'
  );

  if function_sql = original_function_sql then
    raise exception 'Expected add-on confirmation conflict clause was not found';
  end if;

  execute function_sql;
end;
$migration$;

revoke all on function public.confirm_booking_addon_by_token_hash(text)
from public, anon, authenticated;
grant execute on function public.confirm_booking_addon_by_token_hash(text)
to service_role;

notify pgrst, 'reload schema';
