-- PROPOSAL ONLY: do not apply without explicit migration approval.
--
-- Generalizes the existing persistent public-capability limiter for server-side
-- Auth and outbound-message protection while preserving the legacy RPC contract.

create index if not exists confirmation_rate_limits_updated_at_idx
on public.confirmation_rate_limits (updated_at);

create or replace function public.consume_application_rate_limit(
  p_bucket_key text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer,
  p_block_seconds integer default 60
)
returns table (
  allowed boolean,
  remaining_requests integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.confirmation_rate_limits%rowtype;
  v_allowed boolean;
  v_remaining integer;
  v_retry_after integer;
  v_reset_at timestamptz;
begin
  if p_bucket_key is null
    or p_bucket_key !~ '^[a-f0-9]{64}$'
    or p_action is null
    or char_length(p_action) < 1
    or char_length(p_action) > 80
    or p_max_requests < 1
    or p_max_requests > 10000
    or p_window_seconds < 1
    or p_window_seconds > 86400
    or p_block_seconds < 1
    or p_block_seconds > 86400
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid application rate-limit configuration.';
  end if;

  insert into public.confirmation_rate_limits as current_bucket (
    bucket_key,
    action,
    window_start,
    request_count,
    blocked_until,
    updated_at
  )
  values (
    p_bucket_key,
    p_action,
    v_now,
    1,
    null,
    v_now
  )
  on conflict (bucket_key, action) do update
  set window_start = case
        when current_bucket.blocked_until is not null
          and current_bucket.blocked_until > v_now
          then current_bucket.window_start
        when current_bucket.blocked_until is not null
          then v_now
        when current_bucket.window_start
          + pg_catalog.make_interval(secs => p_window_seconds) <= v_now
          then v_now
        else current_bucket.window_start
      end,
      request_count = case
        when current_bucket.blocked_until is not null
          and current_bucket.blocked_until > v_now
          then current_bucket.request_count
        when current_bucket.blocked_until is not null
          then 1
        when current_bucket.window_start
          + pg_catalog.make_interval(secs => p_window_seconds) <= v_now
          then 1
        else current_bucket.request_count + 1
      end,
      blocked_until = case
        when current_bucket.blocked_until is not null
          and current_bucket.blocked_until > v_now
          then current_bucket.blocked_until
        when current_bucket.blocked_until is not null
          then null
        when current_bucket.window_start
          + pg_catalog.make_interval(secs => p_window_seconds) <= v_now
          then null
        when current_bucket.request_count + 1 > p_max_requests
          then v_now + pg_catalog.make_interval(secs => p_block_seconds)
        else null
      end,
      updated_at = v_now
  returning current_bucket.* into v_row;

  v_allowed := v_row.blocked_until is null or v_row.blocked_until <= v_now;
  v_remaining := case
    when v_allowed then greatest(p_max_requests - v_row.request_count, 0)
    else 0
  end;
  v_retry_after := case
    when v_allowed then 0
    else greatest(
      1,
      pg_catalog.ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer
    )
  end;
  v_reset_at := case
    when v_allowed then
      v_row.window_start + pg_catalog.make_interval(secs => p_window_seconds)
    else v_row.blocked_until
  end;

  return query
  select v_allowed, v_remaining, v_retry_after, v_reset_at;
end;
$$;

create or replace function public.clear_application_rate_limit(
  p_bucket_key text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_bucket_key is null
    or p_bucket_key !~ '^[a-f0-9]{64}$'
    or p_action is null
    or char_length(p_action) < 1
    or char_length(p_action) > 80
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid application rate-limit bucket.';
  end if;

  delete from public.confirmation_rate_limits
  where bucket_key = p_bucket_key
    and action = p_action;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

create or replace function public.cleanup_application_rate_limits(
  p_retention_seconds integer default 172800,
  p_batch_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_deleted integer;
begin
  if p_retention_seconds < 3600
    or p_retention_seconds > 2592000
    or p_batch_size < 1
    or p_batch_size > 5000
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid application rate-limit cleanup configuration.';
  end if;

  with stale_buckets as (
    select bucket.ctid
    from public.confirmation_rate_limits as bucket
    where bucket.updated_at
        < v_now - pg_catalog.make_interval(secs => p_retention_seconds)
      and (bucket.blocked_until is null or bucket.blocked_until <= v_now)
    order by bucket.updated_at asc
    limit p_batch_size
    for update skip locked
  )
  delete from public.confirmation_rate_limits as bucket
  where bucket.ctid in (select stale_buckets.ctid from stale_buckets);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.consume_confirmation_rate_limit(
  p_bucket_key text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer,
  p_block_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if p_bucket_key is null
    or p_bucket_key !~ '^[a-f0-9]{64}$'
    or p_action is null
    or char_length(p_action) < 1
    or char_length(p_action) > 80
    or p_max_requests < 1
    or p_max_requests > 10000
    or p_window_seconds < 1
    or p_window_seconds > 86400
    or p_block_seconds < 1
    or p_block_seconds > 86400
  then
    return false;
  end if;

  select result.allowed
  into v_allowed
  from public.consume_application_rate_limit(
    p_bucket_key,
    p_action,
    p_max_requests,
    p_window_seconds,
    p_block_seconds
  ) as result;

  return coalesce(v_allowed, false);
end;
$$;

alter function public.consume_application_rate_limit(text, text, integer, integer, integer)
owner to postgres;
alter function public.clear_application_rate_limit(text, text)
owner to postgres;
alter function public.cleanup_application_rate_limits(integer, integer)
owner to postgres;
alter function public.consume_confirmation_rate_limit(text, text, integer, integer, integer)
owner to postgres;

alter table public.confirmation_rate_limits enable row level security;

revoke all on public.confirmation_rate_limits from public, anon, authenticated;
revoke all on function public.consume_application_rate_limit(text, text, integer, integer, integer)
from public, anon, authenticated;
revoke all on function public.clear_application_rate_limit(text, text)
from public, anon, authenticated;
revoke all on function public.cleanup_application_rate_limits(integer, integer)
from public, anon, authenticated;
revoke all on function public.consume_confirmation_rate_limit(text, text, integer, integer, integer)
from public, anon, authenticated;

grant execute on function public.consume_application_rate_limit(text, text, integer, integer, integer)
to service_role;
grant execute on function public.clear_application_rate_limit(text, text)
to service_role;
grant execute on function public.cleanup_application_rate_limits(integer, integer)
to service_role;
grant execute on function public.consume_confirmation_rate_limit(text, text, integer, integer, integer)
to service_role;

comment on function public.consume_application_rate_limit(text, text, integer, integer, integer)
is 'Atomically consumes one persistent application rate-limit request and returns retry metadata.';
comment on function public.clear_application_rate_limit(text, text)
is 'Clears one server-derived rate-limit bucket after a trusted successful flow.';
comment on function public.cleanup_application_rate_limits(integer, integer)
is 'Deletes a bounded batch of expired application rate-limit buckets.';
comment on function public.consume_confirmation_rate_limit(text, text, integer, integer, integer)
is 'Compatibility wrapper for existing public capability rate-limit callers.';

notify pgrst, 'reload schema';
