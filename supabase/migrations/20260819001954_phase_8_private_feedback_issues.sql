alter type public.audit_event_type add value if not exists 'FEEDBACK_LINK_CREATED';
alter type public.audit_event_type add value if not exists 'FEEDBACK_LINK_REVOKED';
alter type public.audit_event_type add value if not exists 'FEEDBACK_LINK_REGENERATED';
alter type public.audit_event_type add value if not exists 'FEEDBACK_SUBMITTED';
alter type public.audit_event_type add value if not exists 'ISSUE_CREATED';
alter type public.audit_event_type add value if not exists 'ISSUE_RESOLVED';

do $$
begin
  create type public.booking_issue_category as enum (
    'LATE_DELIVERY',
    'CUSTOMER_REQUESTED_CHANGE',
    'PRODUCT_DAMAGED',
    'COMMUNICATION_ISSUE',
    'PAYMENT_BALANCE_ISSUE',
    'NO_SHOW',
    'OTHER'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.booking_issue_status as enum ('OPEN', 'RESOLVED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.feedback_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  token_hash text not null,
  purpose text not null default 'booking_feedback',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint feedback_links_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint feedback_links_token_hash_key unique (token_hash),
  constraint feedback_links_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint feedback_links_purpose_check check (purpose = 'booking_feedback'),
  constraint feedback_links_expires_after_created check (expires_at > created_at),
  constraint feedback_links_used_after_created check (used_at is null or used_at >= created_at),
  constraint feedback_links_revoked_after_created check (revoked_at is null or revoked_at >= created_at),
  constraint feedback_links_revoked_reason_length check (revoked_reason is null or char_length(revoked_reason) <= 80)
);

create unique index if not exists feedback_links_one_open_link_per_booking_idx
on public.feedback_links (booking_id)
where used_at is null and revoked_at is null;

create index if not exists feedback_links_business_idx
on public.feedback_links (business_id, created_at desc);

create index if not exists feedback_links_booking_idx
on public.feedback_links (booking_id, created_at desc);

create index if not exists feedback_links_expires_idx
on public.feedback_links (expires_at);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  customer_id uuid not null,
  feedback_link_id uuid not null references public.feedback_links(id) on delete restrict,
  overall_rating integer not null,
  on_time boolean not null,
  met_expectations boolean not null,
  comment text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint feedback_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint feedback_customer_business_fk
    foreign key (business_id, customer_id)
    references public.customers (business_id, id)
    on delete cascade,
  constraint feedback_booking_key unique (booking_id),
  constraint feedback_link_key unique (feedback_link_id),
  constraint feedback_rating_range check (overall_rating between 1 and 5),
  constraint feedback_comment_length check (comment is null or char_length(comment) <= 2000),
  constraint feedback_comment_plain check (comment is null or comment = regexp_replace(comment, '<[^>]*>', '', 'g')),
  constraint feedback_created_matches_submitted check (created_at = submitted_at)
);

create index if not exists feedback_business_submitted_idx
on public.feedback (business_id, submitted_at desc);

create index if not exists feedback_customer_idx
on public.feedback (business_id, customer_id, submitted_at desc);

create table if not exists public.booking_issues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  category public.booking_issue_category not null,
  description text not null,
  status public.booking_issue_status not null default 'OPEN',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  constraint booking_issues_booking_business_fk
    foreign key (business_id, booking_id)
    references public.bookings (business_id, id)
    on delete cascade,
  constraint booking_issues_description_length check (char_length(trim(description)) between 1 and 2000),
  constraint booking_issues_resolution_state check (
    (status = 'OPEN' and resolved_at is null and resolved_by is null)
    or (status = 'RESOLVED' and resolved_at is not null and resolved_by is not null)
  )
);

create index if not exists booking_issues_booking_idx
on public.booking_issues (business_id, booking_id, created_at desc);

create index if not exists booking_issues_status_idx
on public.booking_issues (business_id, status, created_at desc);

create or replace function private.revoke_open_feedback_links(
  target_booking_id uuid,
  reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  revoked_count integer;
begin
  update public.feedback_links
  set revoked_at = coalesce(revoked_at, now()),
      revoked_reason = reason
  where booking_id = target_booking_id
    and used_at is null
    and revoked_at is null;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

create or replace function private.customer_feedback_view(
  link_row public.feedback_links
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  booking_row public.bookings;
  business_row public.businesses;
begin
  select *
  into booking_row
  from public.bookings
  where id = link_row.booking_id
    and business_id = link_row.business_id;

  if not found then
    return null;
  end if;

  select *
  into business_row
  from public.businesses
  where id = booking_row.business_id;

  if business_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'business_name', business_row.name,
    'booking_reference', booking_row.reference,
    'booking_title', booking_row.title,
    'completed_at', booking_row.completed_at,
    'expires_at', link_row.expires_at
  );
end;
$$;

create or replace function private.enforce_feedback_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row public.bookings;
  link_row public.feedback_links;
  v_now timestamptz := now();
begin
  if tg_op = 'UPDATE' then
    raise exception 'feedback_immutable'
      using errcode = '23000';
  end if;

  select *
  into booking_row
  from public.bookings
  where id = new.booking_id
    and business_id = new.business_id;

  if not found
    or booking_row.customer_id is distinct from new.customer_id
    or booking_row.status <> 'COMPLETED'
  then
    raise exception 'feedback_requires_completed_booking'
      using errcode = '23000';
  end if;

  select *
  into link_row
  from public.feedback_links
  where id = new.feedback_link_id
    and business_id = new.business_id
    and booking_id = new.booking_id;

  if not found then
    raise exception 'feedback_link_mismatch'
      using errcode = '23000';
  end if;

  new.comment := nullif(trim(coalesce(new.comment, '')), '');
  new.submitted_at := v_now;
  new.created_at := v_now;
  return new;
end;
$$;

create or replace function private.enforce_booking_issue_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_exists boolean;
  v_now timestamptz := now();
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.bookings
    where id = new.booking_id
      and business_id = new.business_id
  )
  into booking_exists;

  if not booking_exists then
    raise exception 'issue_booking_not_found'
      using errcode = '23000';
  end if;

  if tg_op = 'INSERT' then
    new.description := trim(new.description);
    new.status := 'OPEN';
    new.created_by := caller_user_id;
    new.created_at := v_now;
    new.resolved_by := null;
    new.resolved_at := null;
    return new;
  end if;

  if old.business_id is distinct from new.business_id
    or old.booking_id is distinct from new.booking_id
    or old.category is distinct from new.category
    or old.description is distinct from new.description
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at
  then
    raise exception 'issue_fields_immutable'
      using errcode = '23000';
  end if;

  if old.status = 'RESOLVED' then
    raise exception 'issue_already_resolved'
      using errcode = '23000';
  end if;

  if old.status = 'OPEN' and new.status = 'RESOLVED' then
    new.resolved_by := caller_user_id;
    new.resolved_at := v_now;
    return new;
  end if;

  raise exception 'invalid_issue_status_transition'
    using errcode = '23000';
end;
$$;

create or replace function public.create_booking_feedback_link(
  p_booking_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default now() + interval '14 days'
)
returns table (
  feedback_link_id uuid,
  expires_at timestamptz,
  replaced_link_count integer
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  revoked_count integer;
  inserted_link_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() then
    raise exception 'feedback_link_expiration_must_be_future'
      using errcode = '22023';
  end if;

  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  if booking_row.status <> 'COMPLETED' then
    raise exception 'booking_not_eligible_for_feedback_link'
      using errcode = '23000';
  end if;

  if exists (
    select 1
    from public.feedback
    where booking_id = booking_row.id
  ) then
    raise exception 'feedback_already_submitted'
      using errcode = '23000';
  end if;

  revoked_count := private.revoke_open_feedback_links(booking_row.id, 'regenerated');

  insert into public.feedback_links (
    business_id,
    booking_id,
    token_hash,
    expires_at,
    created_by
  )
  values (
    booking_row.business_id,
    booking_row.id,
    p_token_hash,
    p_expires_at,
    caller_user_id
  )
  returning id into inserted_link_id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    caller_user_id,
    booking_row.business_id,
    case when revoked_count > 0 then 'FEEDBACK_LINK_REGENERATED'::public.audit_event_type else 'FEEDBACK_LINK_CREATED'::public.audit_event_type end,
    jsonb_build_object(
      'booking_id', booking_row.id,
      'feedback_link_id', inserted_link_id,
      'expires_at', p_expires_at,
      'replaced_link_count', revoked_count
    )
  );

  return query select inserted_link_id, p_expires_at, revoked_count;
end;
$$;

create or replace function public.revoke_booking_feedback_link(
  p_booking_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  booking_row public.bookings;
  revoked_count integer;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authentication_required'
      using errcode = '28000';
  end if;

  select *
  into booking_row
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or not private.is_business_member(booking_row.business_id) then
    raise exception 'booking_not_found_or_unauthorized'
      using errcode = '42501';
  end if;

  revoked_count := private.revoke_open_feedback_links(booking_row.id, 'vendor_revoked');

  if revoked_count > 0 then
    insert into public.audit_logs (
      actor_user_id,
      business_id,
      event_type,
      metadata
    )
    values (
      caller_user_id,
      booking_row.business_id,
      'FEEDBACK_LINK_REVOKED',
      jsonb_build_object('booking_id', booking_row.id, 'revoked_link_count', revoked_count)
    );
  end if;

  return revoked_count;
end;
$$;

create or replace function public.get_feedback_public_view(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  link_row public.feedback_links;
  booking_status public.booking_status;
  view_data jsonb;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into link_row
  from public.feedback_links
  where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select status
  into booking_status
  from public.bookings
  where id = link_row.booking_id
    and business_id = link_row.business_id;

  if booking_status is null then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.used_at is not null then
    view_data := private.customer_feedback_view(link_row);
    return jsonb_build_object('status', 'submitted', 'booking', view_data);
  end if;

  if link_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  if booking_status <> 'COMPLETED' then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  view_data := private.customer_feedback_view(link_row);

  if view_data is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return jsonb_build_object('status', 'valid', 'booking', view_data);
end;
$$;

create or replace function public.submit_feedback_by_token_hash(
  p_token_hash text,
  p_overall_rating integer,
  p_on_time boolean,
  p_met_expectations boolean,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  link_row public.feedback_links;
  booking_row public.bookings;
  inserted_feedback_id uuid;
  clean_comment text;
  submitted_time timestamptz := now();
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if p_overall_rating < 1 or p_overall_rating > 5 then
    return jsonb_build_object('status', 'invalid_feedback');
  end if;

  if p_on_time is null or p_met_expectations is null then
    return jsonb_build_object('status', 'invalid_feedback');
  end if;

  clean_comment := nullif(trim(coalesce(p_comment, '')), '');

  if clean_comment is not null and char_length(clean_comment) > 2000 then
    return jsonb_build_object('status', 'invalid_feedback');
  end if;

  if clean_comment is not null and clean_comment <> regexp_replace(clean_comment, '<[^>]*>', '', 'g') then
    return jsonb_build_object('status', 'invalid_feedback');
  end if;

  select *
  into link_row
  from public.feedback_links
  where token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into booking_row
  from public.bookings
  where id = link_row.booking_id
    and business_id = link_row.business_id
  for update;

  if not found or booking_row.status <> 'COMPLETED' then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.used_at is not null then
    return jsonb_build_object('status', 'already_submitted');
  end if;

  if link_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= submitted_time then
    return jsonb_build_object('status', 'expired');
  end if;

  if exists (
    select 1
    from public.feedback
    where booking_id = booking_row.id
  ) then
    update public.feedback_links
    set used_at = coalesce(used_at, submitted_time)
    where id = link_row.id;
    return jsonb_build_object('status', 'already_submitted');
  end if;

  insert into public.feedback (
    business_id,
    booking_id,
    customer_id,
    feedback_link_id,
    overall_rating,
    on_time,
    met_expectations,
    comment,
    submitted_at,
    created_at
  )
  values (
    booking_row.business_id,
    booking_row.id,
    booking_row.customer_id,
    link_row.id,
    p_overall_rating,
    p_on_time,
    p_met_expectations,
    clean_comment,
    submitted_time,
    submitted_time
  )
  returning id into inserted_feedback_id;

  update public.feedback_links
  set used_at = submitted_time
  where id = link_row.id;

  insert into public.audit_logs (
    actor_user_id,
    business_id,
    event_type,
    metadata
  )
  values (
    null,
    booking_row.business_id,
    'FEEDBACK_SUBMITTED',
    jsonb_build_object(
      'booking_id', booking_row.id,
      'feedback_id', inserted_feedback_id,
      'feedback_link_id', link_row.id,
      'overall_rating', p_overall_rating,
      'on_time', p_on_time,
      'met_expectations', p_met_expectations
    )
  );

  return jsonb_build_object(
    'status', 'submitted',
    'business_id', booking_row.business_id,
    'booking_id', booking_row.id,
    'feedback_id', inserted_feedback_id,
    'submitted_at', submitted_time
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 'already_submitted');
end;
$$;

drop trigger if exists feedback_enforce_integrity on public.feedback;
create trigger feedback_enforce_integrity
before insert or update on public.feedback
for each row execute function private.enforce_feedback_integrity();

drop trigger if exists booking_issues_enforce_integrity on public.booking_issues;
create trigger booking_issues_enforce_integrity
before insert or update on public.booking_issues
for each row execute function private.enforce_booking_issue_integrity();

alter table public.feedback_links enable row level security;
alter table public.feedback enable row level security;
alter table public.booking_issues enable row level security;

revoke all on public.feedback_links from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
revoke all on public.booking_issues from anon, authenticated;

grant select on public.feedback to authenticated;
grant select, insert, update on public.booking_issues to authenticated;

grant select, insert, update, delete on public.feedback_links to service_role;
grant select, insert, update, delete on public.feedback to service_role;
grant select, insert, update, delete on public.booking_issues to service_role;

revoke all on function private.revoke_open_feedback_links(uuid, text) from public, anon, authenticated;
revoke all on function private.customer_feedback_view(public.feedback_links) from public, anon, authenticated;
revoke all on function private.enforce_feedback_integrity() from public, anon, authenticated;
revoke all on function private.enforce_booking_issue_integrity() from public, anon, authenticated;

revoke all on function public.create_booking_feedback_link(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_booking_feedback_link(uuid) from public, anon, authenticated;
revoke all on function public.get_feedback_public_view(text) from public, anon, authenticated;
revoke all on function public.submit_feedback_by_token_hash(text, integer, boolean, boolean, text) from public, anon, authenticated;

grant execute on function public.create_booking_feedback_link(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_booking_feedback_link(uuid) to authenticated;
grant execute on function public.get_feedback_public_view(text) to service_role;
grant execute on function public.submit_feedback_by_token_hash(text, integer, boolean, boolean, text) to service_role;

drop policy if exists "Members can read feedback" on public.feedback;
create policy "Members can read feedback"
on public.feedback
for select
to authenticated
using (private.is_business_member(business_id));

drop policy if exists "Members can read booking issues" on public.booking_issues;
create policy "Members can read booking issues"
on public.booking_issues
for select
to authenticated
using (private.is_business_member(business_id));

drop policy if exists "Members can create booking issues" on public.booking_issues;
create policy "Members can create booking issues"
on public.booking_issues
for insert
to authenticated
with check (private.is_business_member(business_id));

drop policy if exists "Members can resolve booking issues" on public.booking_issues;
create policy "Members can resolve booking issues"
on public.booking_issues
for update
to authenticated
using (private.is_business_member(business_id))
with check (private.is_business_member(business_id));

notify pgrst, 'reload schema';
