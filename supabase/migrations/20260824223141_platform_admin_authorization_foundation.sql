create type public.platform_admin_role as enum ('SUPER_ADMIN');
create type public.platform_admin_status as enum ('ACTIVE', 'DISABLED');

alter type public.audit_event_type add value if not exists 'PLATFORM_ADMIN_CREATED';
alter type public.audit_event_type add value if not exists 'PLATFORM_ADMIN_UPDATED';
alter type public.audit_event_type add value if not exists 'PLATFORM_ADMIN_DISABLED';

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role public.platform_admin_role not null,
  status public.platform_admin_status not null default 'DISABLED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

alter table public.platform_admins enable row level security;

revoke all on table public.platform_admins from public, anon, authenticated;

comment on table public.platform_admins is
  'Platform-wide operator authority. This is intentionally separate from tenant business membership.';
comment on column public.platform_admins.created_by is
  'Authenticated platform operator responsible for creation, or null for a controlled database bootstrap.';
comment on column public.platform_admins.updated_by is
  'Authenticated platform operator responsible for the latest role or status change, or null for a controlled database operation.';

create or replace function private.prepare_platform_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();

    if auth.uid() is not null then
      new.updated_by := auth.uid();
    end if;
  elsif auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

create or replace function private.audit_platform_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type public.audit_event_type;
  v_actor_user_id uuid;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'PLATFORM_ADMIN_CREATED';
    v_actor_user_id := coalesce(auth.uid(), new.created_by);

    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      v_actor_user_id,
      null,
      v_event_type,
      jsonb_build_object(
        'target_user_id', new.user_id,
        'role', new.role,
        'status', new.status,
        'actor_source', case when v_actor_user_id is null then 'CONTROLLED_DATABASE_OPERATOR' else 'AUTHENTICATED_USER' end
      )
    );

    return new;
  end if;

  if old.role is not distinct from new.role
    and old.status is not distinct from new.status then
    return new;
  end if;

  v_event_type := case
    when old.status is distinct from new.status
      and new.status = 'DISABLED' then 'PLATFORM_ADMIN_DISABLED'::public.audit_event_type
    else 'PLATFORM_ADMIN_UPDATED'::public.audit_event_type
  end;
  v_actor_user_id := coalesce(auth.uid(), new.updated_by);

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    v_actor_user_id,
    null,
    v_event_type,
    jsonb_build_object(
      'target_user_id', new.user_id,
      'previous_role', old.role,
      'new_role', new.role,
      'previous_status', old.status,
      'new_status', new.status,
      'actor_source', case when v_actor_user_id is null then 'CONTROLLED_DATABASE_OPERATOR' else 'AUTHENTICATED_USER' end
    )
  );

  return new;
end;
$$;

revoke all on function private.prepare_platform_admin_change() from public;
revoke all on function private.audit_platform_admin_change() from public;

create trigger platform_admins_prepare_change
before insert or update on public.platform_admins
for each row execute function private.prepare_platform_admin_change();

create trigger platform_admins_audit_change
after insert or update of role, status on public.platform_admins
for each row execute function private.audit_platform_admin_change();

create or replace function public.get_my_platform_admin()
returns table (
  user_id uuid,
  role public.platform_admin_role,
  status public.platform_admin_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    platform_admin.user_id,
    platform_admin.role,
    platform_admin.status
  from public.platform_admins as platform_admin
  where platform_admin.user_id = (select auth.uid())
    and platform_admin.status = 'ACTIVE'::public.platform_admin_status;
$$;

revoke all on function public.get_my_platform_admin() from public, anon, authenticated;
grant execute on function public.get_my_platform_admin() to authenticated;
