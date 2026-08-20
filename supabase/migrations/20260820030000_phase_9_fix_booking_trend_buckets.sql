-- Keep created and completed booking trend counts on their documented event
-- timestamps. The original aggregate grouped both values by booking creation.

do $migration$
declare
  function_sql text;
  original_function_sql text;
  old_trend_sql text := $old$
          select
            date_trunc(bucket_granularity, b.created_at) as period_start,
            count(*)::integer as created_count,
            count(*) filter (
              where b.status = 'COMPLETED'
                and b.completed_at >= p_from
                and b.completed_at < p_to
            )::integer as completed_count
          from public.bookings b
          where b.business_id = p_business_id
            and b.created_at >= p_from
            and b.created_at < p_to
          group by date_trunc(bucket_granularity, b.created_at)
$old$;
  new_trend_sql text := $new$
          select
            coalesce(created.period_start, completed.period_start) as period_start,
            coalesce(created.created_count, 0)::integer as created_count,
            coalesce(completed.completed_count, 0)::integer as completed_count
          from (
            select
              date_trunc(bucket_granularity, b.created_at) as period_start,
              count(*)::integer as created_count
            from public.bookings b
            where b.business_id = p_business_id
              and b.created_at >= p_from
              and b.created_at < p_to
            group by date_trunc(bucket_granularity, b.created_at)
          ) created
          full outer join (
            select
              date_trunc(bucket_granularity, b.completed_at) as period_start,
              count(*)::integer as completed_count
            from public.bookings b
            where b.business_id = p_business_id
              and b.status = 'COMPLETED'
              and b.completed_at >= p_from
              and b.completed_at < p_to
            group by date_trunc(bucket_granularity, b.completed_at)
          ) completed using (period_start)
$new$;
begin
  select pg_get_functiondef(
    'public.get_business_insights(uuid,timestamptz,timestamptz)'::regprocedure
  )
  into function_sql;

  original_function_sql := function_sql;
  function_sql := replace(function_sql, old_trend_sql, new_trend_sql);

  if function_sql = original_function_sql then
    raise exception 'Expected booking trend SQL was not found';
  end if;

  execute function_sql;
end;
$migration$;

revoke all on function public.get_business_insights(uuid, timestamptz, timestamptz)
from public, anon, authenticated;

grant execute on function public.get_business_insights(uuid, timestamptz, timestamptz)
to authenticated;
