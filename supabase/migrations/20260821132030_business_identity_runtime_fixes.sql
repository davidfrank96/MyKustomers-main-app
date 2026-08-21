drop function public.create_business_onboarding(
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
);

create or replace function public.create_business_onboarding(
  business_name text,
  business_slug text,
  business_category text,
  business_description text,
  business_phone text,
  business_email text,
  business_whatsapp text,
  business_instagram text,
  business_address_text text,
  business_website text
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
        'terms_hash', confirmation_row.terms_hash,
        'contact_email_masked', private.mask_contact_email(confirmation_row.contact_email)
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

revoke all on function public.get_confirmation_public_view(text)
from public, anon, authenticated;
grant execute on function public.get_confirmation_public_view(text) to service_role;

notify pgrst, 'reload schema';
