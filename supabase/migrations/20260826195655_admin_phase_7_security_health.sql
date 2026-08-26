create or replace function public.get_platform_admin_health_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_stale_email_cutoff timestamptz := v_now - interval '15 minutes';
  v_recent_cutoff timestamptz := v_now - interval '24 hours';
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  with email_health as (
    select
      count(*) filter (
        where email_event.status = 'PENDING'::public.email_event_status
      ) as pending,
      count(*) filter (
        where email_event.status = 'SENDING'::public.email_event_status
      ) as sending,
      count(*) filter (
        where email_event.status = 'SENT'::public.email_event_status
          and email_event.sent_at >= v_recent_cutoff
      ) as accepted_24h,
      count(*) filter (
        where email_event.status = 'FAILED'::public.email_event_status
      ) as failed,
      count(*) filter (
        where email_event.status = 'FAILED'::public.email_event_status
          and coalesce(email_event.last_attempt_at, email_event.created_at) >= v_recent_cutoff
      ) as failed_24h,
      count(*) filter (
        where email_event.status = 'PENDING'::public.email_event_status
          and coalesce(email_event.last_attempt_at, email_event.created_at) < v_stale_email_cutoff
      ) as stale_pending,
      count(*) filter (
        where email_event.status = 'SENDING'::public.email_event_status
          and coalesce(email_event.last_attempt_at, email_event.created_at) < v_stale_email_cutoff
      ) as stale_sending,
      min(coalesce(email_event.last_attempt_at, email_event.created_at)) filter (
        where email_event.status = 'PENDING'::public.email_event_status
      ) as oldest_pending_at,
      min(coalesce(email_event.last_attempt_at, email_event.created_at)) filter (
        where email_event.status = 'SENDING'::public.email_event_status
      ) as oldest_sending_at
    from public.email_events as email_event
  ),
  attempt_health as (
    select count(*) as failed_24h
    from public.email_delivery_attempts as attempt
    where attempt.status = 'FAILED'::public.email_delivery_attempt_status
      and attempt.completed_at >= v_recent_cutoff
  ),
  issue_health as (
    select
      count(*) filter (
        where issue.status = 'OPEN'::public.booking_issue_status
      ) as open,
      count(*) filter (
        where issue.created_at >= v_recent_cutoff
      ) as created_24h,
      min(issue.created_at) filter (
        where issue.status = 'OPEN'::public.booking_issue_status
      ) as oldest_open_at
    from public.booking_issues as issue
  ),
  booking_health as (
    select count(*) as overdue
    from public.bookings as booking
    where booking.scheduled_for < v_now
      and booking.status not in (
        'DELIVERED'::public.booking_status,
        'COMPLETED'::public.booking_status,
        'CANCELLED'::public.booking_status
      )
  ),
  admin_health as (
    select
      count(*) filter (
        where platform_admin.status = 'ACTIVE'::public.platform_admin_status
      ) as active,
      count(*) filter (
        where platform_admin.status = 'DISABLED'::public.platform_admin_status
      ) as disabled
    from public.platform_admins as platform_admin
  )
  select jsonb_build_object(
    'checked_at', v_now,
    'stale_email_threshold_minutes', 15,
    'database', jsonb_build_object(
      'minimal_read_succeeded', true
    ),
    'email', jsonb_build_object(
      'pending', email_health.pending,
      'sending', email_health.sending,
      'accepted_24h', email_health.accepted_24h,
      'failed', email_health.failed,
      'failed_24h', email_health.failed_24h,
      'failed_attempts_24h', attempt_health.failed_24h,
      'stale_pending', email_health.stale_pending,
      'stale_sending', email_health.stale_sending,
      'oldest_pending_at', email_health.oldest_pending_at,
      'oldest_sending_at', email_health.oldest_sending_at
    ),
    'issues', jsonb_build_object(
      'open', issue_health.open,
      'created_24h', issue_health.created_24h,
      'oldest_open_at', issue_health.oldest_open_at
    ),
    'bookings', jsonb_build_object(
      'overdue', booking_health.overdue
    ),
    'admins', jsonb_build_object(
      'active', admin_health.active,
      'disabled', admin_health.disabled
    )
  )
  into v_result
  from email_health
  cross join attempt_health
  cross join issue_health
  cross join booking_health
  cross join admin_health;

  return v_result;
end;
$$;

alter function public.get_platform_admin_health_summary() owner to postgres;

revoke all on function public.get_platform_admin_health_summary()
from public, anon, authenticated;

grant execute on function public.get_platform_admin_health_summary()
to authenticated;

comment on function public.get_platform_admin_health_summary() is
  'Returns a bounded, read-only, platform-wide health summary to the active platform admin caller only.';

create or replace function public.get_platform_admin_security_activity(
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 20);
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  with recent_audits as materialized (
    select
      audit.id,
      audit.actor_user_id,
      audit.event_type,
      audit.metadata,
      audit.created_at
    from public.audit_logs as audit
    where audit.event_type in (
      'PLATFORM_ADMIN_CREATED'::public.audit_event_type,
      'PLATFORM_ADMIN_UPDATED'::public.audit_event_type,
      'PLATFORM_ADMIN_DISABLED'::public.audit_event_type,
      'PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED'::public.audit_event_type,
      'PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED'::public.audit_event_type,
      'PLATFORM_ADMIN_EMAIL_RETRY_FAILED'::public.audit_event_type
    )
    order by audit.created_at desc, audit.id desc
    limit v_limit
  ),
  recent_activity as materialized (
    select
      audit.id,
      audit.actor_user_id,
      audit.event_type,
      audit.metadata,
      audit.created_at,
      actor_profile.display_name as actor_display_name,
      actor_auth.email as actor_email,
      actor_admin.user_id is not null as actor_is_platform_admin
    from recent_audits as audit
    left join public.platform_admins as actor_admin
      on actor_admin.user_id = audit.actor_user_id
    left join public.profiles as actor_profile
      on actor_profile.id = actor_admin.user_id
    left join auth.users as actor_auth
      on actor_auth.id = actor_admin.user_id
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', recent.id,
        'event_type', recent.event_type,
        'actor', jsonb_build_object(
          'display_name', case
            when recent.actor_is_platform_admin then recent.actor_display_name
            else null
          end,
          'email', case
            when recent.actor_is_platform_admin then recent.actor_email
            else null
          end,
          'source', case
            when recent.actor_is_platform_admin then 'PLATFORM_ADMIN'
            when recent.actor_user_id is null then 'CONTROLLED_DATABASE_OPERATOR'
            else 'UNKNOWN_AUTHENTICATED_ACTOR'
          end
        ),
        'target', jsonb_build_object(
          'type', case
            when recent.event_type in (
              'PLATFORM_ADMIN_CREATED'::public.audit_event_type,
              'PLATFORM_ADMIN_UPDATED'::public.audit_event_type,
              'PLATFORM_ADMIN_DISABLED'::public.audit_event_type
            ) then 'PLATFORM_ADMIN'
            else 'EMAIL_EVENT'
          end,
          'reference', case
            when recent.event_type in (
              'PLATFORM_ADMIN_CREATED'::public.audit_event_type,
              'PLATFORM_ADMIN_UPDATED'::public.audit_event_type,
              'PLATFORM_ADMIN_DISABLED'::public.audit_event_type
            ) then left(recent.metadata ->> 'target_user_id', 36)
            else left(recent.metadata ->> 'email_event_id', 36)
          end
        ),
        'reason', case
          when recent.event_type in (
            'PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED'::public.audit_event_type,
            'PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED'::public.audit_event_type,
            'PLATFORM_ADMIN_EMAIL_RETRY_FAILED'::public.audit_event_type
          ) then nullif(trim(left(recent.metadata ->> 'reason', 500)), '')
          else null
        end,
        'result', case recent.event_type
          when 'PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED'::public.audit_event_type
            then 'REQUESTED'
          when 'PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED'::public.audit_event_type
            then 'PROVIDER_ACCEPTED'
          when 'PLATFORM_ADMIN_EMAIL_RETRY_FAILED'::public.audit_event_type
            then 'FAILED'
          else 'RECORDED'
        end,
        'created_at', recent.created_at
      )
      order by recent.created_at desc, recent.id desc
    ), '[]'::jsonb)
  )
  into v_result
  from recent_activity as recent;

  return v_result;
end;
$$;

alter function public.get_platform_admin_security_activity(integer)
owner to postgres;

revoke all on function public.get_platform_admin_security_activity(integer)
from public, anon, authenticated;

grant execute on function public.get_platform_admin_security_activity(integer)
to authenticated;

comment on function public.get_platform_admin_security_activity(integer) is
  'Returns up to 20 allowlisted platform-admin security events with minimized actor and target context to the active platform admin caller only.';

notify pgrst, 'reload schema';
