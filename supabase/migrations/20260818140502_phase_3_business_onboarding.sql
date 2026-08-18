alter table public.businesses
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists whatsapp text,
  add column if not exists instagram text,
  add column if not exists address_text text,
  add column if not exists onboarding_completed_at timestamptz;

update public.businesses
set
  slug = coalesce(slug, 'business-' || left(id::text, 8)),
  category = coalesce(category, 'Other'),
  onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where slug is null
   or category is null
   or onboarding_completed_at is null;

alter table public.businesses
  alter column slug set not null,
  alter column category set not null,
  alter column onboarding_completed_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_slug_length'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_slug_length check (char_length(slug) between 3 and 60);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_slug_format'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_category_allowed'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_category_allowed check (
        category in (
          'Food & Catering',
          'Bakery',
          'Fashion',
          'Beauty',
          'Photography',
          'Events',
          'Cleaning',
          'Professional Services',
          'Other'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_description_length'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_description_length
      check (description is null or char_length(description) <= 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_phone_format'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_phone_format
      check (phone is null or (char_length(phone) between 7 and 32 and phone ~ '^[0-9+().[:space:]-]+$'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_whatsapp_format'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_whatsapp_format
      check (whatsapp is null or (char_length(whatsapp) between 7 and 32 and whatsapp ~ '^[0-9+().[:space:]-]+$'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_email_format'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_email_format
      check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_instagram_format'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_instagram_format
      check (instagram is null or (char_length(instagram) between 1 and 30 and instagram ~ '^[a-z0-9._]+$'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_address_text_length'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_address_text_length
      check (address_text is null or char_length(address_text) <= 500);
  end if;
end $$;

create unique index if not exists businesses_slug_key
on public.businesses (slug);

alter type public.audit_event_type add value if not exists 'BUSINESS_UPDATED';

create or replace function public.create_business_onboarding(
  business_name text,
  business_slug text,
  business_category text,
  business_description text default null,
  business_phone text default null,
  business_email text default null,
  business_whatsapp text default null,
  business_instagram text default null,
  business_address_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  caller_user_id uuid;
  base_slug text;
  candidate_slug text;
  suffix integer := 2;
  suffix_text text;
  new_business_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'authenticated_user_required'
      using errcode = '28000';
  end if;

  business_name := nullif(trim(business_name), '');
  business_slug := nullif(trim(lower(business_slug)), '');
  business_description := nullif(trim(business_description), '');
  business_phone := nullif(trim(business_phone), '');
  business_email := nullif(trim(lower(business_email)), '');
  business_whatsapp := nullif(trim(business_whatsapp), '');
  business_instagram := nullif(trim(lower(regexp_replace(coalesce(business_instagram, ''), '^@', ''))), '');
  business_address_text := nullif(trim(business_address_text), '');

  if business_name is null or char_length(business_name) > 160 then
    raise exception 'invalid_business_name'
      using errcode = '22023';
  end if;

  if business_slug is null
    or char_length(business_slug) < 3
    or char_length(business_slug) > 60
    or business_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'invalid_business_slug'
      using errcode = '22023';
  end if;

  if business_category not in (
    'Food & Catering',
    'Bakery',
    'Fashion',
    'Beauty',
    'Photography',
    'Events',
    'Cleaning',
    'Professional Services',
    'Other'
  ) then
    raise exception 'invalid_business_category'
      using errcode = '22023';
  end if;

  if business_description is not null and char_length(business_description) > 1000 then
    raise exception 'invalid_business_description'
      using errcode = '22023';
  end if;

  if business_phone is not null
    and (char_length(business_phone) not between 7 and 32 or business_phone !~ '^[0-9+().[:space:]-]+$')
  then
    raise exception 'invalid_business_phone'
      using errcode = '22023';
  end if;

  if business_whatsapp is not null
    and (char_length(business_whatsapp) not between 7 and 32 or business_whatsapp !~ '^[0-9+().[:space:]-]+$')
  then
    raise exception 'invalid_business_whatsapp'
      using errcode = '22023';
  end if;

  if business_email is not null
    and (char_length(business_email) > 254 or business_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  then
    raise exception 'invalid_business_email'
      using errcode = '22023';
  end if;

  if business_instagram is not null
    and (char_length(business_instagram) not between 1 and 30 or business_instagram !~ '^[a-z0-9._]+$')
  then
    raise exception 'invalid_business_instagram'
      using errcode = '22023';
  end if;

  if business_address_text is not null and char_length(business_address_text) > 500 then
    raise exception 'invalid_business_address'
      using errcode = '22023';
  end if;

  base_slug := business_slug;
  candidate_slug := base_slug;

  loop
    begin
      insert into public.businesses (
        name,
        slug,
        category,
        description,
        phone,
        email,
        whatsapp,
        instagram,
        address_text,
        onboarding_completed_at,
        created_by
      )
      values (
        business_name,
        candidate_slug,
        business_category,
        business_description,
        business_phone,
        business_email,
        business_whatsapp,
        business_instagram,
        business_address_text,
        now(),
        caller_user_id
      )
      returning id into new_business_id;

      exit;
    exception
      when unique_violation then
        if suffix > 50 then
          raise exception 'slug_unavailable'
            using errcode = '23505';
        end if;

        suffix_text := '-' || suffix::text;
        candidate_slug := rtrim(left(base_slug, 60 - char_length(suffix_text)), '-') || suffix_text;
        suffix := suffix + 1;
    end;
  end loop;

  insert into public.business_members (business_id, user_id, role, status)
  values (new_business_id, caller_user_id, 'owner', 'active');

  insert into public.audit_logs (actor_user_id, business_id, event_type, metadata)
  values
    (caller_user_id, new_business_id, 'BUSINESS_CREATED', jsonb_build_object('source', 'create_business_onboarding')),
    (caller_user_id, new_business_id, 'MEMBERSHIP_CREATED', jsonb_build_object('role', 'owner', 'source', 'create_business_onboarding'));

  return new_business_id;
end;
$$;

revoke all on function public.create_business_onboarding(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.create_business_onboarding(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

notify pgrst, 'reload schema';
