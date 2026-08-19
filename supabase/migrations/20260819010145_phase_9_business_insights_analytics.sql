-- Phase 9: private business insights and analytics
-- Aggregates remain tenant-private business data. The application resolves the
-- current business server-side; this RPC also rejects arbitrary tenant access.

create index if not exists bookings_business_created_at_idx
on public.bookings (business_id, created_at);

create index if not exists bookings_business_status_completed_at_idx
on public.bookings (business_id, status, completed_at);

create index if not exists bookings_business_status_cancelled_at_idx
on public.bookings (business_id, status, cancelled_at);

create index if not exists bookings_business_customer_created_at_idx
on public.bookings (business_id, customer_id, created_at);

create index if not exists bookings_business_schedule_status_idx
on public.bookings (business_id, scheduled_for, status);

create index if not exists feedback_business_submitted_at_idx
on public.feedback (business_id, submitted_at);

create index if not exists booking_issues_business_created_at_idx
on public.booking_issues (business_id, created_at);

create index if not exists booking_issues_business_resolved_at_idx
on public.booking_issues (business_id, resolved_at);

create or replace function public.get_business_insights(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  range_duration interval;
  bucket_granularity text;
  current_time timestamptz := statement_timestamp();
  result jsonb;
begin
  if (select auth.uid()) is null or not private.is_business_member(p_business_id) then
    raise exception 'Not authorized to access analytics for this business'
      using errcode = '42501';
  end if;

  if p_business_id is null or p_from is null or p_to is null then
    raise exception 'Analytics business and date range are required'
      using errcode = '22023';
  end if;

  if p_from >= p_to then
    raise exception 'Analytics date range must have from before to'
      using errcode = '22023';
  end if;

  if p_to - p_from > interval '5 years' then
    raise exception 'Analytics date range cannot exceed five years'
      using errcode = '22023';
  end if;

  range_duration := p_to - p_from;
  bucket_granularity := case
    when range_duration > interval '90 days' then 'month'
    else 'day'
  end;

  with
  qualifying_lifetime as (
    select
      b.customer_id,
      count(*)::integer as qualifying_booking_count
    from public.bookings b
    where b.business_id = p_business_id
      and b.status not in ('DRAFT', 'CANCELLED')
    group by b.customer_id
  ),
  first_qualifying as (
    select
      b.customer_id,
      min(b.created_at) as first_booking_at
    from public.bookings b
    where b.business_id = p_business_id
      and b.status not in ('DRAFT', 'CANCELLED')
    group by b.customer_id
  ),
  period_customers as (
    select distinct b.customer_id
    from public.bookings b
    where b.business_id = p_business_id
      and b.created_at >= p_from
      and b.created_at < p_to
      and b.status not in ('DRAFT', 'CANCELLED')
  ),
  customer_metrics as (
    select
      (
        select count(*)::integer
        from public.customers c
        where c.business_id = p_business_id
          and c.archived_at is null
      ) as total_active_customers,
      (
        select count(*)::integer
        from first_qualifying fq
        where fq.first_booking_at >= p_from
          and fq.first_booking_at < p_to
      ) as new_customers,
      (
        select count(*)::integer
        from period_customers pc
        join qualifying_lifetime ql on ql.customer_id = pc.customer_id
        where ql.qualifying_booking_count >= 2
      ) as returning_customers,
      (
        select count(*)::integer
        from period_customers
      ) as period_qualifying_customers
  ),
  booking_metrics as (
    select
      count(*) filter (
        where b.created_at >= p_from
          and b.created_at < p_to
      )::integer as bookings_created,
      count(*) filter (
        where b.status = 'COMPLETED'
          and b.completed_at >= p_from
          and b.completed_at < p_to
      )::integer as completed_bookings,
      count(*) filter (
        where b.status = 'CANCELLED'
          and b.cancelled_at >= p_from
          and b.cancelled_at < p_to
      )::integer as cancelled_bookings,
      count(*) filter (
        where b.status not in ('COMPLETED', 'CANCELLED')
      )::integer as active_bookings
    from public.bookings b
    where b.business_id = p_business_id
  ),
  operation_metrics as (
    select
      count(*) filter (
        where b.status = 'COMPLETED'
          and b.completed_at >= p_from
          and b.completed_at < p_to
          and b.scheduled_for is not null
          and b.delivered_at is not null
      )::integer as on_time_eligible_bookings,
      count(*) filter (
        where b.status = 'COMPLETED'
          and b.completed_at >= p_from
          and b.completed_at < p_to
          and b.scheduled_for is not null
          and b.delivered_at is not null
          and b.delivered_at <= b.scheduled_for
      )::integer as on_time_bookings,
      count(*) filter (
        where b.status not in ('DELIVERED', 'COMPLETED', 'CANCELLED')
          and b.scheduled_for is not null
          and b.scheduled_for < current_time
      )::integer as overdue_bookings,
      count(*) filter (
        where b.status = 'COMPLETED'
          and b.completed_at >= p_from
          and b.completed_at < p_to
      )::integer as finalized_completed_bookings,
      count(*) filter (
        where b.status = 'CANCELLED'
          and b.cancelled_at >= p_from
          and b.cancelled_at < p_to
      )::integer as finalized_cancelled_bookings,
      round(avg(extract(epoch from (b.completed_at - b.started_at))) filter (
        where b.status = 'COMPLETED'
          and b.completed_at >= p_from
          and b.completed_at < p_to
          and b.started_at is not null
          and b.completed_at is not null
      ) / 60)::integer as average_fulfillment_minutes
    from public.bookings b
    where b.business_id = p_business_id
  ),
  feedback_metrics as (
    select
      count(*)::integer as responses,
      avg(f.overall_rating)::numeric as average_rating,
      count(*) filter (where f.on_time)::integer as on_time_yes,
      count(*) filter (where f.met_expectations)::integer as met_expectations_yes
    from public.feedback f
    where f.business_id = p_business_id
      and f.submitted_at >= p_from
      and f.submitted_at < p_to
  ),
  issue_metrics as (
    select
      count(*) filter (
        where i.created_at >= p_from
          and i.created_at < p_to
      )::integer as opened,
      count(*) filter (
        where i.resolved_at >= p_from
          and i.resolved_at < p_to
      )::integer as resolved,
      count(*) filter (
        where i.created_at >= p_from
          and i.created_at < p_to
          and i.status = 'RESOLVED'
      )::integer as opened_and_resolved
    from public.booking_issues i
    where i.business_id = p_business_id
  )
  select jsonb_build_object(
    'range', jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'bucket', bucket_granularity
    ),
    'customers', (
      select jsonb_build_object(
        'totalActive', cm.total_active_customers,
        'new', cm.new_customers,
        'returning', cm.returning_customers,
        'periodQualifying', cm.period_qualifying_customers,
        'repeatRate', case
          when cm.period_qualifying_customers = 0 then null
          else cm.returning_customers::numeric / cm.period_qualifying_customers
        end
      )
      from customer_metrics cm
    ),
    'bookings', (
      select jsonb_build_object(
        'created', bm.bookings_created,
        'completed', bm.completed_bookings,
        'cancelled', bm.cancelled_bookings,
        'active', bm.active_bookings
      )
      from booking_metrics bm
    ),
    'value', jsonb_build_object(
      'recorded', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', value_rows.currency,
          'amountMinor', value_rows.amount_minor,
          'bookingCount', value_rows.booking_count
        ) order by value_rows.currency)
        from (
          select
            b.currency,
            sum(b.total_amount_minor)::bigint as amount_minor,
            count(*)::integer as booking_count
          from public.bookings b
          where b.business_id = p_business_id
            and b.created_at >= p_from
            and b.created_at < p_to
            and b.status not in ('DRAFT', 'CANCELLED')
          group by b.currency
        ) value_rows
      ), '[]'::jsonb),
      'completed', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', value_rows.currency,
          'amountMinor', value_rows.amount_minor,
          'bookingCount', value_rows.booking_count
        ) order by value_rows.currency)
        from (
          select
            b.currency,
            sum(b.total_amount_minor)::bigint as amount_minor,
            count(*)::integer as booking_count
          from public.bookings b
          where b.business_id = p_business_id
            and b.status = 'COMPLETED'
            and b.completed_at >= p_from
            and b.completed_at < p_to
          group by b.currency
        ) value_rows
      ), '[]'::jsonb),
      'average', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', value_rows.currency,
          'amountMinor', value_rows.average_minor,
          'bookingCount', value_rows.booking_count
        ) order by value_rows.currency)
        from (
          select
            b.currency,
            round(avg(b.total_amount_minor))::bigint as average_minor,
            count(*)::integer as booking_count
          from public.bookings b
          where b.business_id = p_business_id
            and b.created_at >= p_from
            and b.created_at < p_to
            and b.status not in ('DRAFT', 'CANCELLED')
          group by b.currency
        ) value_rows
      ), '[]'::jsonb),
      'deposits', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', value_rows.currency,
          'amountMinor', value_rows.amount_minor,
          'bookingCount', value_rows.booking_count
        ) order by value_rows.currency)
        from (
          select
            b.currency,
            sum(b.deposit_amount_minor)::bigint as amount_minor,
            count(*)::integer as booking_count
          from public.bookings b
          where b.business_id = p_business_id
            and b.created_at >= p_from
            and b.created_at < p_to
            and b.status not in ('DRAFT', 'CANCELLED')
          group by b.currency
        ) value_rows
      ), '[]'::jsonb)
    ),
    'operations', (
      select jsonb_build_object(
        'onTimeEligible', om.on_time_eligible_bookings,
        'onTimeCount', om.on_time_bookings,
        'onTimeRate', case
          when om.on_time_eligible_bookings = 0 then null
          else om.on_time_bookings::numeric / om.on_time_eligible_bookings
        end,
        'overdue', om.overdue_bookings,
        'cancellationEligible', om.finalized_completed_bookings + om.finalized_cancelled_bookings,
        'cancellationRate', case
          when om.finalized_completed_bookings + om.finalized_cancelled_bookings = 0 then null
          else om.finalized_cancelled_bookings::numeric /
            (om.finalized_completed_bookings + om.finalized_cancelled_bookings)
        end,
        'averageFulfillmentMinutes', om.average_fulfillment_minutes
      )
      from operation_metrics om
    ),
    'feedback', (
      select jsonb_build_object(
        'responses', fm.responses,
        'averageRating', fm.average_rating,
        'onTimeYes', fm.on_time_yes,
        'onTimePercentage', case
          when fm.responses = 0 then null
          else fm.on_time_yes::numeric / fm.responses
        end,
        'metExpectationsYes', fm.met_expectations_yes,
        'metExpectationsPercentage', case
          when fm.responses = 0 then null
          else fm.met_expectations_yes::numeric / fm.responses
        end
      )
      from feedback_metrics fm
    ),
    'issues', (
      select jsonb_build_object(
        'opened', im.opened,
        'resolved', im.resolved,
        'resolutionRate', case
          when im.opened = 0 then null
          else im.opened_and_resolved::numeric / im.opened
        end,
        'categories', coalesce((
          select jsonb_agg(jsonb_build_object(
            'category', category_rows.category,
            'count', category_rows.issue_count
          ) order by category_rows.issue_count desc, category_rows.category)
          from (
            select
              i.category,
              count(*)::integer as issue_count
            from public.booking_issues i
            where i.business_id = p_business_id
              and i.created_at >= p_from
              and i.created_at < p_to
            group by i.category
          ) category_rows
        ), '[]'::jsonb)
      )
      from issue_metrics im
    ),
    'trends', jsonb_build_object(
      'bookings', coalesce((
        select jsonb_agg(jsonb_build_object(
          'periodStart', trend_rows.period_start,
          'created', trend_rows.created_count,
          'completed', trend_rows.completed_count
        ) order by trend_rows.period_start)
        from (
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
        ) trend_rows
      ), '[]'::jsonb),
      'completedValue', coalesce((
        select jsonb_agg(jsonb_build_object(
          'periodStart', trend_rows.period_start,
          'currency', trend_rows.currency,
          'amountMinor', trend_rows.amount_minor
        ) order by trend_rows.period_start, trend_rows.currency)
        from (
          select
            date_trunc(bucket_granularity, b.completed_at) as period_start,
            b.currency,
            sum(b.total_amount_minor)::bigint as amount_minor
          from public.bookings b
          where b.business_id = p_business_id
            and b.status = 'COMPLETED'
            and b.completed_at >= p_from
            and b.completed_at < p_to
          group by date_trunc(bucket_granularity, b.completed_at), b.currency
        ) trend_rows
      ), '[]'::jsonb),
      'feedbackRating', coalesce((
        select jsonb_agg(jsonb_build_object(
          'periodStart', trend_rows.period_start,
          'averageRating', trend_rows.average_rating,
          'responses', trend_rows.responses
        ) order by trend_rows.period_start)
        from (
          select
            date_trunc(bucket_granularity, f.submitted_at) as period_start,
            avg(f.overall_rating)::numeric as average_rating,
            count(*)::integer as responses
          from public.feedback f
          where f.business_id = p_business_id
            and f.submitted_at >= p_from
            and f.submitted_at < p_to
          group by date_trunc(bucket_granularity, f.submitted_at)
        ) trend_rows
      ), '[]'::jsonb)
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_business_insights(uuid, timestamptz, timestamptz)
from public, anon, authenticated;

grant execute on function public.get_business_insights(uuid, timestamptz, timestamptz)
to authenticated;
