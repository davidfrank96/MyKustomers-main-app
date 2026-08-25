create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_overview jsonb;
begin
  if auth.uid() is null
    or not exists (
      select 1
      from public.platform_admins as platform_admin
      where platform_admin.user_id = auth.uid()
        and platform_admin.role = 'SUPER_ADMIN'::public.platform_admin_role
        and platform_admin.status = 'ACTIVE'::public.platform_admin_status
    )
  then
    raise exception 'platform_admin_required'
      using errcode = '42501';
  end if;

  v_day_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_day_end := v_day_start + interval '1 day';

  with booking_counts as (
    select
      count(*) as total,
      count(*) filter (
        where booking.status not in (
          'COMPLETED'::public.booking_status,
          'CANCELLED'::public.booking_status
        )
      ) as active,
      count(*) filter (
        where booking.scheduled_for >= v_day_start
          and booking.scheduled_for < v_day_end
          and booking.status not in (
            'COMPLETED'::public.booking_status,
            'CANCELLED'::public.booking_status
          )
      ) as due_today,
      count(*) filter (
        where booking.scheduled_for < v_now
          and booking.status not in (
            'DELIVERED'::public.booking_status,
            'COMPLETED'::public.booking_status,
            'CANCELLED'::public.booking_status
          )
      ) as overdue,
      count(*) filter (
        where booking.status = 'COMPLETED'::public.booking_status
      ) as completed
    from public.bookings as booking
  ),
  email_counts as (
    select
      count(*) filter (
        where email_event.status = 'PENDING'::public.email_event_status
      ) as pending,
      count(*) filter (
        where email_event.status = 'SENDING'::public.email_event_status
      ) as sending,
      count(*) filter (
        where email_event.status = 'SENT'::public.email_event_status
      ) as sent,
      count(*) filter (
        where email_event.status = 'FAILED'::public.email_event_status
      ) as failed
    from public.email_events as email_event
  )
  select jsonb_build_object(
    'businesses', (select count(*) from public.businesses),
    'platform_users', (select count(*) from public.profiles),
    'customers', (select count(*) from public.customers),
    'bookings', booking_counts.total,
    'active_bookings', booking_counts.active,
    'due_today', booking_counts.due_today,
    'overdue', booking_counts.overdue,
    'completed', booking_counts.completed,
    'open_issues', (
      select count(*)
      from public.booking_issues as booking_issue
      where booking_issue.status = 'OPEN'::public.booking_issue_status
    ),
    'email_pending', email_counts.pending,
    'email_sending', email_counts.sending,
    'email_sent', email_counts.sent,
    'email_failed', email_counts.failed,
    'refreshed_at', v_now
  )
  into v_overview
  from booking_counts
  cross join email_counts;

  return v_overview;
end;
$$;

revoke all on function public.get_platform_admin_overview()
from public, anon, authenticated;

grant execute on function public.get_platform_admin_overview()
to authenticated;

comment on function public.get_platform_admin_overview() is
  'Returns platform-wide read-only operational aggregates to the active platform admin caller only.';

notify pgrst, 'reload schema';
