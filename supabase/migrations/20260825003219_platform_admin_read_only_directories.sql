create or replace function private.require_platform_admin_read_access()
returns void
language plpgsql
stable
set search_path = ''
as $$
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
end;
$$;

alter function private.require_platform_admin_read_access() owner to postgres;

revoke all on function private.require_platform_admin_read_access()
from public, anon, authenticated;

create or replace function public.get_platform_admin_businesses(
  p_search text default null,
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
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  with matching as materialized (
    select business.*
    from public.businesses as business
    where v_search is null
      or position(v_search in lower(business.name)) > 0
      or position(v_search in lower(business.slug)) > 0
      or position(v_search in lower(coalesce(business.email, ''))) > 0
      or position(v_search in lower(coalesce(business.phone, ''))) > 0
      or position(v_search in lower(coalesce(business.website, ''))) > 0
  ),
  paged as materialized (
    select matching.*
    from matching
    order by matching.created_at desc, matching.id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  ),
  owner_rows as (
    select
      membership.business_id,
      jsonb_agg(
        jsonb_build_object(
          'user_id', membership.user_id,
          'display_name', profile.display_name,
          'email', auth_user.email
        )
        order by coalesce(profile.display_name, auth_user.email, membership.user_id::text),
          membership.user_id
      ) as owners
    from public.business_members as membership
    join paged on paged.id = membership.business_id
    join auth.users as auth_user on auth_user.id = membership.user_id
    left join public.profiles as profile on profile.id = membership.user_id
    where membership.role = 'owner'::public.business_member_role
      and membership.status = 'active'::public.business_member_status
    group by membership.business_id
  ),
  member_counts as (
    select membership.business_id, count(*) as total
    from public.business_members as membership
    join paged on paged.id = membership.business_id
    where membership.status = 'active'::public.business_member_status
    group by membership.business_id
  ),
  customer_counts as (
    select customer.business_id, count(*) as total
    from public.customers as customer
    join paged on paged.id = customer.business_id
    group by customer.business_id
  ),
  booking_counts as (
    select
      booking.business_id,
      count(*) as total,
      count(*) filter (
        where booking.status not in (
          'COMPLETED'::public.booking_status,
          'CANCELLED'::public.booking_status
        )
      ) as active
    from public.bookings as booking
    join paged on paged.id = booking.business_id
    group by booking.business_id
  )
  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', paged.id,
          'name', paged.name,
          'slug', paged.slug,
          'email', paged.email,
          'website', paged.website,
          'logo_path', paged.logo_path,
          'created_at', paged.created_at,
          'owners', coalesce(owner_rows.owners, '[]'::jsonb),
          'member_count', coalesce(member_counts.total, 0),
          'customer_count', coalesce(customer_counts.total, 0),
          'booking_count', coalesce(booking_counts.total, 0),
          'active_booking_count', coalesce(booking_counts.active, 0)
        )
        order by paged.created_at desc, paged.id desc
      ),
      '[]'::jsonb
    ),
    'page', v_page,
    'page_size', v_page_size,
    'total', (select count(*) from matching)
  )
  into v_result
  from paged
  left join owner_rows on owner_rows.business_id = paged.id
  left join member_counts on member_counts.business_id = paged.id
  left join customer_counts on customer_counts.business_id = paged.id
  left join booking_counts on booking_counts.business_id = paged.id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_businesses(text, integer, integer)
owner to postgres;

create or replace function public.get_platform_admin_business(
  p_business_id uuid
)
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
    'id', business.id,
    'name', business.name,
    'slug', business.slug,
    'category', business.category,
    'website', business.website,
    'instagram', business.instagram,
    'email', business.email,
    'phone', business.phone,
    'logo_path', business.logo_path,
    'created_at', business.created_at,
    'onboarding_completed_at', business.onboarding_completed_at,
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', membership.user_id,
          'display_name', profile.display_name,
          'email', auth_user.email,
          'role', membership.role,
          'status', membership.status,
          'created_at', membership.created_at
        )
        order by
          case when membership.role = 'owner'::public.business_member_role then 0 else 1 end,
          coalesce(profile.display_name, auth_user.email, membership.user_id::text),
          membership.user_id
      )
      from public.business_members as membership
      join auth.users as auth_user on auth_user.id = membership.user_id
      left join public.profiles as profile on profile.id = membership.user_id
      where membership.business_id = business.id
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'customers', (
        select count(*) from public.customers as customer
        where customer.business_id = business.id
      ),
      'bookings', (
        select count(*) from public.bookings as booking
        where booking.business_id = business.id
      ),
      'active_bookings', (
        select count(*) from public.bookings as booking
        where booking.business_id = business.id
          and booking.status not in (
            'COMPLETED'::public.booking_status,
            'CANCELLED'::public.booking_status
          )
      ),
      'completed_bookings', (
        select count(*) from public.bookings as booking
        where booking.business_id = business.id
          and booking.status = 'COMPLETED'::public.booking_status
      ),
      'open_issues', (
        select count(*) from public.booking_issues as issue
        where issue.business_id = business.id
          and issue.status = 'OPEN'::public.booking_issue_status
      ),
      'failed_emails', (
        select count(*) from public.email_events as email_event
        where email_event.business_id = business.id
          and email_event.status = 'FAILED'::public.email_event_status
      ),
      'pending_emails', (
        select count(*) from public.email_events as email_event
        where email_event.business_id = business.id
          and email_event.status = 'PENDING'::public.email_event_status
      )
    )
  )
  into v_result
  from public.businesses as business
  where business.id = p_business_id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_business(uuid) owner to postgres;

create or replace function public.get_platform_admin_users(
  p_search text default null,
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
  v_result jsonb;
begin
  perform private.require_platform_admin_read_access();

  with matching as materialized (
    select
      auth_user.id,
      auth_user.email,
      auth_user.created_at,
      profile.display_name
    from auth.users as auth_user
    left join public.profiles as profile on profile.id = auth_user.id
    where v_search is null
      or position(v_search in lower(coalesce(auth_user.email, ''))) > 0
      or position(v_search in lower(coalesce(profile.display_name, ''))) > 0
  ),
  paged as materialized (
    select matching.*
    from matching
    order by matching.created_at desc, matching.id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  ),
  membership_counts as (
    select membership.user_id, count(*) as total
    from public.business_members as membership
    join paged on paged.id = membership.user_id
    group by membership.user_id
  ),
  provider_rows as (
    select providers.user_id, jsonb_agg(providers.provider order by providers.provider) as providers
    from (
      select distinct identity.user_id, identity.provider
      from auth.identities as identity
      join paged on paged.id = identity.user_id
    ) as providers
    group by providers.user_id
  )
  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', paged.id,
          'display_name', paged.display_name,
          'email', paged.email,
          'providers', coalesce(provider_rows.providers, '[]'::jsonb),
          'membership_count', coalesce(membership_counts.total, 0),
          'created_at', paged.created_at
        )
        order by paged.created_at desc, paged.id desc
      ),
      '[]'::jsonb
    ),
    'page', v_page,
    'page_size', v_page_size,
    'total', (select count(*) from matching)
  )
  into v_result
  from paged
  left join membership_counts on membership_counts.user_id = paged.id
  left join provider_rows on provider_rows.user_id = paged.id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_users(text, integer, integer)
owner to postgres;

create or replace function public.get_platform_admin_user(
  p_user_id uuid
)
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
    'id', auth_user.id,
    'display_name', profile.display_name,
    'email', auth_user.email,
    'created_at', auth_user.created_at,
    'last_sign_in_at', auth_user.last_sign_in_at,
    'email_confirmed_at', auth_user.email_confirmed_at,
    'providers', coalesce((
      select jsonb_agg(provider_names.provider order by provider_names.provider)
      from (
        select distinct identity.provider
        from auth.identities as identity
        where identity.user_id = auth_user.id
      ) as provider_names
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'business_id', membership.business_id,
          'business_name', business.name,
          'business_slug', business.slug,
          'role', membership.role,
          'status', membership.status,
          'created_at', membership.created_at
        )
        order by coalesce(business.name, membership.business_id::text), membership.business_id
      )
      from public.business_members as membership
      left join public.businesses as business on business.id = membership.business_id
      where membership.user_id = auth_user.id
    ), '[]'::jsonb),
    'platform_admin', (
      select jsonb_build_object(
        'role', platform_admin.role,
        'status', platform_admin.status
      )
      from public.platform_admins as platform_admin
      where platform_admin.user_id = auth_user.id
    )
  )
  into v_result
  from auth.users as auth_user
  left join public.profiles as profile on profile.id = auth_user.id
  where auth_user.id = p_user_id;

  return v_result;
end;
$$;

alter function public.get_platform_admin_user(uuid) owner to postgres;

revoke all on function public.get_platform_admin_businesses(text, integer, integer)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_business(uuid)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_users(text, integer, integer)
from public, anon, authenticated;
revoke all on function public.get_platform_admin_user(uuid)
from public, anon, authenticated;

grant execute on function public.get_platform_admin_businesses(text, integer, integer)
to authenticated;
grant execute on function public.get_platform_admin_business(uuid)
to authenticated;
grant execute on function public.get_platform_admin_users(text, integer, integer)
to authenticated;
grant execute on function public.get_platform_admin_user(uuid)
to authenticated;

comment on function public.get_platform_admin_businesses(text, integer, integer) is
  'Returns a paginated read-only business support directory to an active platform administrator.';
comment on function public.get_platform_admin_business(uuid) is
  'Returns one read-only business support projection to an active platform administrator.';
comment on function public.get_platform_admin_users(text, integer, integer) is
  'Returns a paginated safe Auth user support projection to an active platform administrator.';
comment on function public.get_platform_admin_user(uuid) is
  'Returns one safe Auth user support projection to an active platform administrator.';

notify pgrst, 'reload schema';
