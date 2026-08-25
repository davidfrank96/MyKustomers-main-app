create or replace function public.get_platform_admin_bookings(
  p_search text default null,
  p_filter text default 'all',
  p_business_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_search text := lower(nullif(trim(left(coalesce(p_search, ''), 80)), ''));
  v_filter text := lower(coalesce(nullif(trim(p_filter), ''), 'all'));
  v_now timestamptz := statement_timestamp();
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  if not (v_filter = any (array[
    'all', 'active', 'draft', 'awaiting_customer', 'confirmed', 'in_progress',
    'ready', 'delivered', 'completed', 'cancelled', 'due_today', 'overdue'
  ])) then
    raise exception 'invalid_admin_booking_filter' using errcode = '22023';
  end if;

  v_day_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_day_end := v_day_start + interval '1 day';

  with matching as materialized (
    select
      booking.id,
      booking.business_id,
      booking.reference,
      booking.title,
      booking.currency,
      booking.total_amount_minor,
      booking.deposit_amount_minor,
      booking.scheduled_for,
      booking.status,
      booking.created_at,
      business.name as business_name,
      business.slug as business_slug,
      customer.name as customer_name
    from public.bookings as booking
    join public.businesses as business on business.id = booking.business_id
    join public.customers as customer
      on customer.id = booking.customer_id
      and customer.business_id = booking.business_id
    where (p_business_id is null or booking.business_id = p_business_id)
      and (
        v_search is null
        or position(v_search in lower(booking.reference)) > 0
        or position(v_search in lower(booking.title)) > 0
        or position(v_search in lower(business.name)) > 0
        or position(v_search in lower(customer.name)) > 0
      )
      and case v_filter
        when 'all' then true
        when 'active' then booking.status not in (
          'COMPLETED'::public.booking_status,
          'CANCELLED'::public.booking_status
        )
        when 'draft' then booking.status = 'DRAFT'::public.booking_status
        when 'awaiting_customer' then booking.status = 'AWAITING_CUSTOMER'::public.booking_status
        when 'confirmed' then booking.status = 'CONFIRMED'::public.booking_status
        when 'in_progress' then booking.status = 'IN_PROGRESS'::public.booking_status
        when 'ready' then booking.status = 'READY'::public.booking_status
        when 'delivered' then booking.status = 'DELIVERED'::public.booking_status
        when 'completed' then booking.status = 'COMPLETED'::public.booking_status
        when 'cancelled' then booking.status = 'CANCELLED'::public.booking_status
        when 'due_today' then
          booking.scheduled_for >= v_day_start
          and booking.scheduled_for < v_day_end
          and booking.status not in (
            'COMPLETED'::public.booking_status,
            'CANCELLED'::public.booking_status
          )
        when 'overdue' then
          booking.scheduled_for < v_now
          and booking.status not in (
            'DELIVERED'::public.booking_status,
            'COMPLETED'::public.booking_status,
            'CANCELLED'::public.booking_status
          )
        else false
      end
  ),
  paged as materialized (
    select matching.*
    from matching
    order by matching.created_at desc, matching.id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  ),
  addon_totals as (
    select
      addon.booking_id,
      sum(addon.total_amount_minor) as total_amount_minor,
      sum(addon.deposit_amount_minor) as deposit_amount_minor
    from public.booking_addons as addon
    join paged on paged.id = addon.booking_id
      and paged.business_id = addon.business_id
    where addon.status = 'CONFIRMED'::public.booking_addon_status
    group by addon.booking_id
  ),
  issue_counts as (
    select
      issue.booking_id,
      count(*) filter (where issue.status = 'OPEN'::public.booking_issue_status) as open_count
    from public.booking_issues as issue
    join paged on paged.id = issue.booking_id
      and paged.business_id = issue.business_id
    group by issue.booking_id
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'reference', paged.reference,
        'title', paged.title,
        'business', jsonb_build_object(
          'id', paged.business_id,
          'name', paged.business_name,
          'slug', paged.business_slug
        ),
        'customer_name', paged.customer_name,
        'status', paged.status,
        'scheduled_for', paged.scheduled_for,
        'currency', paged.currency,
        'effective_total_amount_minor',
          paged.total_amount_minor + coalesce(addon_totals.total_amount_minor, 0),
        'created_at', paged.created_at,
        'open_issue_count', coalesce(issue_counts.open_count, 0)
      )
      order by paged.created_at desc, paged.id desc
    ), '[]'::jsonb),
    'page', v_page,
    'page_size', v_page_size,
    'total', (select count(*) from matching)
  )
  into v_result
  from paged
  left join addon_totals on addon_totals.booking_id = paged.id
  left join issue_counts on issue_counts.booking_id = paged.id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_bookings(text, text, uuid, integer, integer)
owner to postgres;

create or replace function public.get_platform_admin_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  select jsonb_build_object(
    'id', booking.id,
    'reference', booking.reference,
    'title', booking.title,
    'status', booking.status,
    'business', jsonb_build_object(
      'id', business.id,
      'name', business.name,
      'slug', business.slug
    ),
    'customer', jsonb_build_object('name', customer.name),
    'creator', jsonb_build_object(
      'id', booking.created_by,
      'display_name', creator_profile.display_name,
      'email', creator.email
    ),
    'created_at', booking.created_at,
    'scheduled_for', booking.scheduled_for,
    'currency', booking.currency,
    'canonical_total_amount_minor', booking.total_amount_minor,
    'canonical_deposit_amount_minor', booking.deposit_amount_minor,
    'effective_total_amount_minor', booking.total_amount_minor + coalesce((
      select sum(addon.total_amount_minor)
      from public.booking_addons as addon
      where addon.booking_id = booking.id
        and addon.business_id = booking.business_id
        and addon.status = 'CONFIRMED'::public.booking_addon_status
    ), 0),
    'effective_deposit_amount_minor', booking.deposit_amount_minor + coalesce((
      select sum(addon.deposit_amount_minor)
      from public.booking_addons as addon
      where addon.booking_id = booking.id
        and addon.business_id = booking.business_id
        and addon.status = 'CONFIRMED'::public.booking_addon_status
    ), 0),
    'started_at', booking.started_at,
    'ready_at', booking.ready_at,
    'delivered_at', booking.delivered_at,
    'completed_at', booking.completed_at,
    'cancelled_at', booking.cancelled_at,
    'cancellation_reason', booking.cancellation_reason,
    'confirmation', jsonb_build_object(
      'state', case
        when booking.status = 'CANCELLED'::public.booking_status then 'cancelled'
        when booking.customer_confirmed_at is not null then 'confirmed'
        when exists (
          select 1 from public.confirmation_links as link
          where link.booking_id = booking.id
            and link.business_id = booking.business_id
            and link.used_at is null
            and link.revoked_at is null
            and link.expires_at > statement_timestamp()
        ) then 'awaiting_customer'
        when exists (
          select 1 from public.confirmation_links as link
          where link.booking_id = booking.id and link.business_id = booking.business_id
        ) then 'invalidated'
        else 'never_sent'
      end,
      'confirmed_at', booking.customer_confirmed_at,
      'contact_email_masked', (
        select private.mask_contact_email(confirmation.contact_email)
        from public.booking_confirmations as confirmation
        where confirmation.booking_id = booking.id
          and confirmation.business_id = booking.business_id
        order by confirmation.confirmed_at desc, confirmation.id desc
        limit 1
      ),
      'contact_phone_masked', (
        select case
          when confirmation.contact_phone is null then null
          else '***' || right(confirmation.contact_phone, 4)
        end
        from public.booking_confirmations as confirmation
        where confirmation.booking_id = booking.id
          and confirmation.business_id = booking.business_id
        order by confirmation.confirmed_at desc, confirmation.id desc
        limit 1
      ),
      'terms', (
        select jsonb_strip_nulls(jsonb_build_object(
          'title', confirmation.terms_snapshot ->> 'title',
          'scheduled_for', confirmation.terms_snapshot ->> 'scheduled_for',
          'currency', confirmation.terms_snapshot ->> 'currency',
          'total_amount_minor', confirmation.terms_snapshot -> 'total_amount_minor',
          'deposit_amount_minor', confirmation.terms_snapshot -> 'deposit_amount_minor'
        ))
        from public.booking_confirmations as confirmation
        where confirmation.booking_id = booking.id
          and confirmation.business_id = booking.business_id
        order by confirmation.confirmed_at desc, confirmation.id desc
        limit 1
      )
    ),
    'amendments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', amendment.id,
        'status', amendment.status,
        'reason', amendment.reason,
        'changed_fields', amendment.changed_fields,
        'created_at', amendment.created_at,
        'submitted_at', amendment.submitted_at,
        'first_opened_at', amendment.first_opened_at,
        'confirmed_at', amendment.confirmed_at,
        'revoked_at', amendment.revoked_at,
        'revoked_reason', amendment.revoked_reason
      ) order by amendment.created_at desc, amendment.id desc)
      from public.booking_amendments as amendment
      where amendment.booking_id = booking.id
        and amendment.business_id = booking.business_id
    ), '[]'::jsonb),
    'addons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', addon.id,
        'title', addon.title,
        'status', addon.status,
        'currency', addon.currency,
        'total_amount_minor', addon.total_amount_minor,
        'deposit_amount_minor', addon.deposit_amount_minor,
        'created_at', addon.created_at,
        'submitted_at', addon.submitted_at,
        'confirmed_at', addon.confirmed_at,
        'cancelled_at', addon.cancelled_at,
        'cancellation_reason', addon.cancellation_reason
      ) order by addon.created_at desc, addon.id desc)
      from public.booking_addons as addon
      where addon.booking_id = booking.id
        and addon.business_id = booking.business_id
    ), '[]'::jsonb),
    'status_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', history.from_status,
        'to_status', history.to_status,
        'changed_at', history.changed_at
      ) order by history.changed_at, history.id)
      from public.booking_status_history as history
      where history.booking_id = booking.id
        and history.business_id = booking.business_id
    ), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'change_type', change.change_type,
        'previous_scheduled_for', change.previous_scheduled_for,
        'new_scheduled_for', change.new_scheduled_for,
        'changed_fields', change.changed_fields,
        'created_at', change.created_at
      ) order by change.created_at, change.id)
      from public.booking_changes as change
      where change.booking_id = booking.id
        and change.business_id = booking.business_id
    ), '[]'::jsonb),
    'feedback', (
      select jsonb_build_object(
        'overall_rating', feedback.overall_rating,
        'on_time', feedback.on_time,
        'met_expectations', feedback.met_expectations,
        'submitted_at', feedback.submitted_at
      )
      from public.feedback as feedback
      where feedback.booking_id = booking.id
        and feedback.business_id = booking.business_id
    ),
    'issues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', issue.id,
        'category', issue.category,
        'status', issue.status,
        'created_at', issue.created_at,
        'resolved_at', issue.resolved_at
      ) order by issue.created_at desc, issue.id desc)
      from public.booking_issues as issue
      where issue.booking_id = booking.id
        and issue.business_id = booking.business_id
    ), '[]'::jsonb),
    'email_summary', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', grouped.event_type,
        'status', grouped.status,
        'count', grouped.total
      ) order by grouped.event_type, grouped.status)
      from (
        select email_event.event_type, email_event.status, count(*) as total
        from public.email_events as email_event
        where email_event.booking_id = booking.id
          and email_event.business_id = booking.business_id
        group by email_event.event_type, email_event.status
      ) as grouped
    ), '[]'::jsonb)
  )
  into v_result
  from public.bookings as booking
  join public.businesses as business on business.id = booking.business_id
  join public.customers as customer
    on customer.id = booking.customer_id
    and customer.business_id = booking.business_id
  join auth.users as creator on creator.id = booking.created_by
  left join public.profiles as creator_profile on creator_profile.id = booking.created_by
  where booking.id = p_booking_id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_booking(uuid) owner to postgres;

create or replace function public.get_platform_admin_issues(
  p_search text default null,
  p_status text default 'all',
  p_category text default 'all',
  p_business_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_search text := lower(nullif(trim(left(coalesce(p_search, ''), 80)), ''));
  v_status text := upper(coalesce(nullif(trim(p_status), ''), 'ALL'));
  v_category text := upper(coalesce(nullif(trim(p_category), ''), 'ALL'));
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  if not (v_status = any (array['ALL', 'OPEN', 'RESOLVED'])) then
    raise exception 'invalid_admin_issue_status' using errcode = '22023';
  end if;

  if not (v_category = any (array[
    'ALL', 'LATE_DELIVERY', 'CUSTOMER_REQUESTED_CHANGE', 'PRODUCT_DAMAGED',
    'COMMUNICATION_ISSUE', 'PAYMENT_BALANCE_ISSUE', 'NO_SHOW', 'OTHER'
  ])) then
    raise exception 'invalid_admin_issue_category' using errcode = '22023';
  end if;

  with matching as materialized (
    select
      issue.id,
      issue.business_id,
      issue.booking_id,
      issue.category,
      issue.status,
      issue.created_at,
      issue.resolved_at,
      business.name as business_name,
      business.slug as business_slug,
      booking.reference as booking_reference,
      booking.title as booking_title
    from public.booking_issues as issue
    join public.businesses as business on business.id = issue.business_id
    join public.bookings as booking
      on booking.id = issue.booking_id
      and booking.business_id = issue.business_id
    where (p_business_id is null or issue.business_id = p_business_id)
      and (v_status = 'ALL' or issue.status::text = v_status)
      and (v_category = 'ALL' or issue.category::text = v_category)
      and (
        v_search is null
        or position(v_search in lower(booking.reference)) > 0
        or position(v_search in lower(business.name)) > 0
        or position(v_search in replace(lower(issue.category::text), '_', ' ')) > 0
      )
  ),
  paged as materialized (
    select matching.*
    from matching
    order by matching.created_at desc, matching.id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', paged.id,
      'category', paged.category,
      'status', paged.status,
      'business', jsonb_build_object(
        'id', paged.business_id,
        'name', paged.business_name,
        'slug', paged.business_slug
      ),
      'booking', jsonb_build_object(
        'id', paged.booking_id,
        'reference', paged.booking_reference,
        'title', paged.booking_title
      ),
      'created_at', paged.created_at,
      'resolved_at', paged.resolved_at
    ) order by paged.created_at desc, paged.id desc), '[]'::jsonb),
    'page', v_page,
    'page_size', v_page_size,
    'total', (select count(*) from matching)
  )
  into v_result
  from paged;

  return v_result;
end;
$$;

alter function public.get_platform_admin_issues(text, text, text, uuid, integer, integer)
owner to postgres;

create or replace function public.get_platform_admin_issue(p_issue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  select jsonb_build_object(
    'id', issue.id,
    'category', issue.category,
    'status', issue.status,
    'description', issue.description,
    'created_at', issue.created_at,
    'resolved_at', issue.resolved_at,
    'business', jsonb_build_object(
      'id', business.id,
      'name', business.name,
      'slug', business.slug
    ),
    'booking', jsonb_build_object(
      'id', booking.id,
      'reference', booking.reference,
      'title', booking.title,
      'status', booking.status
    ),
    'creator', jsonb_build_object(
      'id', issue.created_by,
      'display_name', creator_profile.display_name,
      'email', creator.email
    ),
    'resolver', case when issue.resolved_by is null then null else jsonb_build_object(
      'id', issue.resolved_by,
      'display_name', resolver_profile.display_name,
      'email', resolver.email
    ) end
  )
  into v_result
  from public.booking_issues as issue
  join public.businesses as business on business.id = issue.business_id
  join public.bookings as booking
    on booking.id = issue.booking_id
    and booking.business_id = issue.business_id
  join auth.users as creator on creator.id = issue.created_by
  left join public.profiles as creator_profile on creator_profile.id = issue.created_by
  left join auth.users as resolver on resolver.id = issue.resolved_by
  left join public.profiles as resolver_profile on resolver_profile.id = issue.resolved_by
  where issue.id = p_issue_id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_issue(uuid) owner to postgres;

revoke all on function public.get_platform_admin_bookings(text, text, uuid, integer, integer)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_booking(uuid)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_issues(text, text, text, uuid, integer, integer)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_issue(uuid)
from public, anon, authenticated;

grant execute on function public.get_platform_admin_bookings(text, text, uuid, integer, integer)
to authenticated;
grant execute on function public.get_platform_admin_booking(uuid)
to authenticated;
grant execute on function public.get_platform_admin_issues(text, text, text, uuid, integer, integer)
to authenticated;
grant execute on function public.get_platform_admin_issue(uuid)
to authenticated;

comment on function public.get_platform_admin_bookings(text, text, uuid, integer, integer) is
  'Returns a paginated minimized booking operations directory to an active platform administrator.';
comment on function public.get_platform_admin_booking(uuid) is
  'Returns one read-only minimized booking operations projection to an active platform administrator.';
comment on function public.get_platform_admin_issues(text, text, text, uuid, integer, integer) is
  'Returns a paginated minimized booking issue directory to an active platform administrator.';
comment on function public.get_platform_admin_issue(uuid) is
  'Returns one read-only booking issue context projection to an active platform administrator.';

notify pgrst, 'reload schema';
