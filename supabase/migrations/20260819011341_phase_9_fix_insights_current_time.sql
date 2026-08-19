-- Follow-up fix for the already-applied Phase 9 analytics RPC.
-- `current_time` is a PostgreSQL special expression, so use an unambiguous
-- PL/pgSQL variable name for the overdue-booking timestamp comparison.

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.get_business_insights(uuid,timestamptz,timestamptz)'::regprocedure
  )
  into function_sql;

  function_sql := replace(
    function_sql,
    'current_time timestamptz := statement_timestamp();',
    'v_current_time timestamptz := statement_timestamp();'
  );
  function_sql := replace(
    function_sql,
    'b.scheduled_for < current_time',
    'b.scheduled_for < v_current_time'
  );

  execute function_sql;
end;
$$;

revoke all on function public.get_business_insights(uuid, timestamptz, timestamptz)
from public, anon, authenticated;

grant execute on function public.get_business_insights(uuid, timestamptz, timestamptz)
to authenticated;
