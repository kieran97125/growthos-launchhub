-- Growth OS LaunchHub data contract v1 security review
-- REVIEW REQUIRED. Apply after the base and hardening migrations.

begin;

-- Active public forms must have a real tenant scope, a valid SHA-256 token hash,
-- and at least one explicitly approved origin.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_forms_launchhub_token_hash_check'
  ) then
    alter table public.lead_forms
      add constraint lead_forms_launchhub_token_hash_check
      check (public_form_token_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_forms_launchhub_active_scope_check'
  ) then
    alter table public.lead_forms
      add constraint lead_forms_launchhub_active_scope_check
      check (
        not is_active
        or (
          client_id is not null
          and brand_id is not null
          and cardinality(allowed_domains) > 0
        )
      );
  end if;
end;
$$;

-- LaunchHub tables are server-owned. RLS remains enabled, and no browser role
-- receives direct table privileges.
revoke all on table public.launchhub_services
  from public, anon, authenticated;
revoke all on table public.launchhub_packages
  from public, anon, authenticated;
revoke all on table public.launchhub_locations
  from public, anon, authenticated;
revoke all on table public.launchhub_form_configs
  from public, anon, authenticated;

-- Replace the v1 writer with a canonical DB-derived writer. The public API may
-- pass display values, but the database verifies them against the configured
-- service, package and location before writing a lead.
create or replace function public.launchhub_create_lead(
  p_form_id uuid,
  p_client_id uuid,
  p_brand_id uuid,
  p_client_key text,
  p_brand_key text,
  p_form_key text,
  p_name text,
  p_phone text,
  p_booking_date date,
  p_booking_time text,
  p_location_name text,
  p_service_name text,
  p_payment_status text,
  p_raw_form_data jsonb,
  p_treatment_price numeric,
  p_treatment_price_label text,
  p_is_test_data boolean,
  p_snapshot jsonb
)
returns table(lead_id uuid, source_snapshot_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  canonical_client_key text;
  canonical_brand_key text;
  canonical_form_key text;
  canonical_is_test_data boolean;
  canonical_service_id uuid;
  canonical_package_id uuid;
  canonical_location_id uuid;
  canonical_service_name text;
  canonical_service_slug text;
  canonical_package_name text;
  canonical_location_name text;
  canonical_currency text;
  canonical_price numeric;
  canonical_payment_required boolean;
  canonical_payment_status text;
  canonical_raw_form_data jsonb;
  new_snapshot_id uuid;
  new_lead_id uuid;
begin
  select
    f.client_key,
    f.brand_key,
    f.form_key,
    f.is_test_form,
    c.default_service_id,
    c.default_package_id,
    c.default_location_id
  into
    canonical_client_key,
    canonical_brand_key,
    canonical_form_key,
    canonical_is_test_data,
    canonical_service_id,
    canonical_package_id,
    canonical_location_id
  from public.lead_forms f
  join public.launchhub_form_configs c
    on c.lead_form_id = f.id
   and c.client_id = f.client_id
   and c.brand_id = f.brand_id
  where f.id = p_form_id
    and f.client_id = p_client_id
    and f.brand_id = p_brand_id
    and f.is_active = true;

  if canonical_form_key is null then
    raise exception 'launchhub_form_scope_invalid';
  end if;

  if p_client_key is distinct from canonical_client_key
    or p_brand_key is distinct from canonical_brand_key
    or p_form_key is distinct from canonical_form_key then
    raise exception 'launchhub_form_identity_mismatch';
  end if;

  select s.name, s.slug
  into canonical_service_name, canonical_service_slug
  from public.launchhub_services s
  where s.id = canonical_service_id
    and s.client_id = p_client_id
    and s.brand_id = p_brand_id
    and s.status = 'active';

  select
    p.name,
    p.currency,
    coalesce(p.promo_price, p.original_price, 0),
    p.payment_required
  into
    canonical_package_name,
    canonical_currency,
    canonical_price,
    canonical_payment_required
  from public.launchhub_packages p
  where p.id = canonical_package_id
    and p.client_id = p_client_id
    and p.brand_id = p_brand_id
    and p.service_id = canonical_service_id
    and p.status = 'active';

  select l.name
  into canonical_location_name
  from public.launchhub_locations l
  where l.id = canonical_location_id
    and l.client_id = p_client_id
    and l.brand_id = p_brand_id
    and l.status = 'active';

  if canonical_service_name is null
    or canonical_package_name is null
    or canonical_location_name is null then
    raise exception 'launchhub_default_configuration_invalid';
  end if;

  if p_service_name is distinct from canonical_service_name
    or p_location_name is distinct from canonical_location_name
    or p_treatment_price is distinct from canonical_price then
    raise exception 'launchhub_submitted_configuration_mismatch';
  end if;

  canonical_payment_status := case
    when canonical_payment_required and p_payment_status = 'pending' then 'pending'
    else 'booking_only'
  end;

  canonical_raw_form_data := coalesce(p_raw_form_data, '{}'::jsonb)
    || jsonb_build_object(
      'form_id', p_form_id,
      'service_id', canonical_service_id,
      'service_name', canonical_service_name,
      'service_slug', canonical_service_slug,
      'package_id', canonical_package_id,
      'package_name', canonical_package_name,
      'location_id', canonical_location_id,
      'location_name', canonical_location_name,
      'currency', canonical_currency,
      'price', canonical_price,
      'payment_status', canonical_payment_status
    );

  insert into public.lead_source_snapshots (
    client_id,
    brand_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fbclid,
    gclid,
    referrer,
    landing_page_url,
    meta_campaign_id,
    meta_adset_id,
    meta_ad_id,
    source_rule_matched,
    confidence,
    audit_reason,
    tracking_status,
    raw_tracking_data,
    client_key,
    brand_key,
    form_key,
    is_test_data
  ) values (
    p_client_id,
    p_brand_id,
    nullif(p_snapshot->>'utm_source', ''),
    nullif(p_snapshot->>'utm_medium', ''),
    nullif(p_snapshot->>'utm_campaign', ''),
    nullif(p_snapshot->>'utm_content', ''),
    nullif(p_snapshot->>'utm_term', ''),
    nullif(p_snapshot->>'fbclid', ''),
    nullif(p_snapshot->>'gclid', ''),
    nullif(p_snapshot->>'referrer', ''),
    nullif(p_snapshot->>'landing_page_url', ''),
    nullif(p_snapshot->>'meta_campaign_id', ''),
    nullif(p_snapshot->>'meta_adset_id', ''),
    nullif(p_snapshot->>'meta_ad_id', ''),
    nullif(p_snapshot->>'source_rule_matched', ''),
    coalesce(nullif(p_snapshot->>'confidence', ''), 'unknown'),
    nullif(p_snapshot->>'audit_reason', ''),
    coalesce(nullif(p_snapshot->>'tracking_status', ''), 'received'),
    coalesce(p_snapshot->'raw_tracking_data', '{}'::jsonb),
    canonical_client_key,
    canonical_brand_key,
    canonical_form_key,
    canonical_is_test_data
  )
  returning id into new_snapshot_id;

  insert into public.leads (
    client_id,
    brand_id,
    source_snapshot_id,
    name,
    phone,
    booking_date,
    booking_time,
    branch,
    treatment,
    payment_status,
    raw_form_data,
    client_key,
    brand_key,
    form_key,
    treatment_price,
    treatment_price_label,
    is_test_data
  ) values (
    p_client_id,
    p_brand_id,
    new_snapshot_id,
    p_name,
    p_phone,
    p_booking_date,
    p_booking_time,
    canonical_location_name,
    canonical_service_name,
    canonical_payment_status,
    canonical_raw_form_data,
    canonical_client_key,
    canonical_brand_key,
    canonical_form_key,
    canonical_price,
    canonical_currency || ' ' || canonical_price::text,
    canonical_is_test_data
  )
  returning id into new_lead_id;

  update public.lead_source_snapshots
  set lead_id = new_lead_id
  where id = new_snapshot_id;

  return query select new_lead_id, new_snapshot_id;
end;
$$;

revoke all on function public.launchhub_create_lead(
  uuid, uuid, uuid, text, text, text, text, text, date, text, text, text,
  text, jsonb, numeric, text, boolean, jsonb
) from public, anon, authenticated;

grant execute on function public.launchhub_create_lead(
  uuid, uuid, uuid, text, text, text, text, text, date, text, text, text,
  text, jsonb, numeric, text, boolean, jsonb
) to service_role;

commit;
