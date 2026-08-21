alter table public.businesses
  add column if not exists website text,
  add column if not exists logo_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_website_safe_url'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_website_safe_url
      check (
        website is null
        or (
          char_length(website) <= 2048
          and website ~ '^https?://[^/[:space:]]+'
          and website !~ '[[:cntrl:][:space:]]'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_logo_path_format'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_logo_path_format
      check (
        logo_path is null
        or logo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/logo[.]webp$'
      );
  end if;
end $$;

create or replace function private.business_logo_object_business_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage
as $$
declare
  folder_parts text[];
begin
  folder_parts := storage.foldername(object_name);

  if array_length(folder_parts, 1) <> 1
    or object_name <> folder_parts[1] || '/logo.webp'
  then
    return null;
  end if;

  return folder_parts[1]::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function private.business_logo_object_business_id(text)
from public, anon, authenticated;
grant execute on function private.business_logo_object_business_id(text)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'business-logos',
  'business-logos',
  true,
  204800,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can read their business logo objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-logos'
  and private.has_business_role(
    private.business_logo_object_business_id(name),
    array['owner']::public.business_member_role[]
  )
);

create policy "Owners can upload their business logo objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-logos'
  and private.has_business_role(
    private.business_logo_object_business_id(name),
    array['owner']::public.business_member_role[]
  )
);

create policy "Owners can replace their business logo objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-logos'
  and private.has_business_role(
    private.business_logo_object_business_id(name),
    array['owner']::public.business_member_role[]
  )
)
with check (
  bucket_id = 'business-logos'
  and private.has_business_role(
    private.business_logo_object_business_id(name),
    array['owner']::public.business_member_role[]
  )
);

create policy "Owners can delete their business logo objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-logos'
  and private.has_business_role(
    private.business_logo_object_business_id(name),
    array['owner']::public.business_member_role[]
  )
);

create or replace function public.create_business_onboarding(
  business_name text,
  business_slug text,
  business_category text,
  business_description text default null,
  business_phone text default null,
  business_email text default null,
  business_whatsapp text default null,
  business_instagram text default null,
  business_address_text text default null,
  business_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  new_business_id uuid;
begin
  business_website := nullif(trim(business_website), '');

  if business_website is not null
    and (
      char_length(business_website) > 2048
      or business_website !~ '^https?://[^/[:space:]]+'
      or business_website ~ '[[:cntrl:][:space:]]'
    )
  then
    raise exception 'invalid_business_website'
      using errcode = '22023';
  end if;

  new_business_id := public.create_business_onboarding(
    business_name,
    business_slug,
    business_category,
    business_description,
    business_phone,
    business_email,
    business_whatsapp,
    business_instagram,
    business_address_text
  );

  update public.businesses
  set website = business_website
  where id = new_business_id;

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
  text,
  text
) to authenticated;

create or replace function private.customer_confirmation_view(
  link_row public.confirmation_links
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  booking_row public.bookings;
  customer_row public.customers;
  business_row public.businesses;
  snapshot jsonb;
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
  into customer_row
  from public.customers
  where id = booking_row.customer_id
    and business_id = booking_row.business_id;

  select *
  into business_row
  from public.businesses
  where id = booking_row.business_id;

  if customer_row.id is null or business_row.id is null then
    return null;
  end if;

  snapshot := private.booking_terms_snapshot(booking_row, customer_row, business_row);

  return jsonb_build_object(
    'business_name', business_row.name,
    'business_logo_path', business_row.logo_path,
    'business_website', business_row.website,
    'business_instagram', business_row.instagram,
    'business_phone', business_row.phone,
    'business_email', business_row.email,
    'customer_name', customer_row.name,
    'booking_reference', booking_row.reference,
    'booking_title', booking_row.title,
    'booking_description', booking_row.description,
    'scheduled_for', booking_row.scheduled_for,
    'currency', booking_row.currency,
    'total_amount_minor', booking_row.total_amount_minor,
    'deposit_amount_minor', booking_row.deposit_amount_minor,
    'balance_amount_minor', booking_row.total_amount_minor - booking_row.deposit_amount_minor,
    'status', booking_row.status,
    'expires_at', link_row.expires_at,
    'confirmed_at', booking_row.customer_confirmed_at,
    'terms_hash', private.booking_terms_hash(snapshot)
  );
end;
$$;

create or replace function public.get_confirmation_public_view(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  link_row public.confirmation_links;
  booking_status public.booking_status;
  confirmation_row public.booking_confirmations;
  business_row public.businesses;
  view_data jsonb;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
  into link_row
  from public.confirmation_links
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
    select *
    into confirmation_row
    from public.booking_confirmations
    where confirmation_link_id = link_row.id;

    if not found then
      return jsonb_build_object('status', 'already_confirmed');
    end if;

    select *
    into business_row
    from public.businesses
    where id = link_row.business_id;

    return jsonb_build_object(
      'status', 'already_confirmed',
      'booking', jsonb_build_object(
        'business_name', confirmation_row.terms_snapshot ->> 'business_name',
        'business_logo_path', business_row.logo_path,
        'business_website', business_row.website,
        'business_instagram', business_row.instagram,
        'business_phone', null,
        'business_email', null,
        'customer_name', confirmation_row.terms_snapshot ->> 'customer_name',
        'booking_reference', confirmation_row.terms_snapshot ->> 'booking_reference',
        'booking_title', confirmation_row.terms_snapshot ->> 'title',
        'booking_description', confirmation_row.terms_snapshot ->> 'description',
        'scheduled_for', confirmation_row.terms_snapshot ->> 'scheduled_for',
        'currency', confirmation_row.terms_snapshot ->> 'currency',
        'total_amount_minor', (confirmation_row.terms_snapshot ->> 'total_amount_minor')::bigint,
        'deposit_amount_minor', (confirmation_row.terms_snapshot ->> 'deposit_amount_minor')::bigint,
        'balance_amount_minor', (confirmation_row.terms_snapshot ->> 'balance_amount_minor')::bigint,
        'status', booking_status,
        'expires_at', link_row.expires_at,
        'confirmed_at', confirmation_row.confirmed_at,
        'terms_hash', confirmation_row.terms_hash
      )
    );
  end if;

  if booking_status in ('CANCELLED', 'COMPLETED') then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  if link_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;

  if link_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  view_data := private.customer_confirmation_view(link_row);

  if view_data is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if booking_status <> 'AWAITING_CUSTOMER' then
    return jsonb_build_object('status', 'booking_unavailable');
  end if;

  return jsonb_build_object('status', 'valid', 'booking', view_data);
end;
$$;

notify pgrst, 'reload schema';
