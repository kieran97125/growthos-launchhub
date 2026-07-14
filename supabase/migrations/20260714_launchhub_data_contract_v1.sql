-- Growth OS LaunchHub data contract v1
-- REVIEW REQUIRED. This migration is committed for code review only.
-- Do not apply to production until tenant scope, RLS, token handling and the
-- synthetic Internal Demo seed have been explicitly approved.

begin;

create table if not exists public.launchhub_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  brand_id uuid not null references public.brands(id),
  service_key text not null,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, brand_id, service_key),
  unique (client_id, brand_id, slug)
);

create table if not exists public.launchhub_packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  brand_id uuid not null references public.brands(id),
  service_id uuid not null references public.launchhub_services(id),
  package_key text not null,
  name text not null,
  original_price numeric(12,2),
  promo_price numeric(12,2),
  currency text not null default 'HKD',
  payment_required boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, brand_id, package_key),
  check (original_price is null or original_price >= 0),
  check (promo_price is null or promo_price >= 0),
  check (char_length(currency) between 3 and 8)
);

create table if not exists public.launchhub_locations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  brand_id uuid not null references public.brands(id),
  location_key text not null,
  name text not null,
  slug text not null,
  address text,
  opening_hours jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, brand_id, location_key),
  unique (client_id, brand_id, slug)
);

create table if not exists public.launchhub_form_configs (
  lead_form_id uuid primary key references public.lead_forms(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  brand_id uuid not null references public.brands(id),
  default_service_id uuid not null references public.launchhub_services(id),
  default_package_id uuid not null references public.launchhub_packages(id),
  default_location_id uuid not null references public.launchhub_locations(id),
  conversion_mode text not null default 'form_submit_pixel'
    check (conversion_mode in ('form_submit_pixel', 'thank_you_redirect')),
  success_redirect_base_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists launchhub_services_scope_idx
  on public.launchhub_services(client_id, brand_id, status);
create index if not exists launchhub_packages_scope_idx
  on public.launchhub_packages(client_id, brand_id, service_id, status);
create index if not exists launchhub_locations_scope_idx
  on public.launchhub_locations(client_id, brand_id, status);
create index if not exists launchhub_form_configs_scope_idx
  on public.launchhub_form_configs(client_id, brand_id);
create index if not exists lead_forms_public_token_hash_idx
  on public.lead_forms(public_form_token_hash)
  where is_active = true;

create or replace function public.launchhub_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.launchhub_validate_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  brand_client_id uuid;
  related_client_id uuid;
  related_brand_id uuid;
  related_service_id uuid;
begin
  select b.client_id
  into brand_client_id
  from public.brands b
  where b.id = new.brand_id;

  if brand_client_id is null or brand_client_id <> new.client_id then
    raise exception 'launchhub_scope_mismatch: brand does not belong to client';
  end if;

  if tg_table_name = 'launchhub_packages' then
    select s.client_id, s.brand_id
    into related_client_id, related_brand_id
    from public.launchhub_services s
    where s.id = new.service_id;

    if related_client_id is null
      or related_client_id <> new.client_id
      or related_brand_id <> new.brand_id then
      raise exception 'launchhub_scope_mismatch: package service is outside tenant scope';
    end if;
  end if;

  if tg_table_name = 'launchhub_form_configs' then
    select f.client_id, f.brand_id
    into related_client_id, related_brand_id
    from public.lead_forms f
    where f.id = new.lead_form_id;

    if related_client_id is null
      or related_brand_id is null
      or related_client_id <> new.client_id
      or related_brand_id <> new.brand_id then
      raise exception 'launchhub_scope_mismatch: lead form is outside tenant scope';
    end if;

    select s.client_id, s.brand_id
    into related_client_id, related_brand_id
    from public.launchhub_services s
    where s.id = new.default_service_id;

    if related_client_id is null
      or related_client_id <> new.client_id
      or related_brand_id <> new.brand_id then
      raise exception 'launchhub_scope_mismatch: default service is outside tenant scope';
    end if;

    select p.client_id, p.brand_id, p.service_id
    into related_client_id, related_brand_id, related_service_id
    from public.launchhub_packages p
    where p.id = new.default_package_id;

    if related_client_id is null
      or related_client_id <> new.client_id
      or related_brand_id <> new.brand_id
      or related_service_id <> new.default_service_id then
      raise exception 'launchhub_scope_mismatch: default package is outside service scope';
    end if;

    select l.client_id, l.brand_id
    into related_client_id, related_brand_id
    from public.launchhub_locations l
    where l.id = new.default_location_id;

    if related_client_id is null
      or related_client_id <> new.client_id
      or related_brand_id <> new.brand_id then
      raise exception 'launchhub_scope_mismatch: default location is outside tenant scope';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists launchhub_services_touch_updated_at
  on public.launchhub_services;
create trigger launchhub_services_touch_updated_at
before update on public.launchhub_services
for each row execute function public.launchhub_touch_updated_at();

drop trigger if exists launchhub_packages_touch_updated_at
  on public.launchhub_packages;
create trigger launchhub_packages_touch_updated_at
before update on public.launchhub_packages
for each row execute function public.launchhub_touch_updated_at();

drop trigger if exists launchhub_locations_touch_updated_at
  on public.launchhub_locations;
create trigger launchhub_locations_touch_updated_at
before update on public.launchhub_locations
for each row execute function public.launchhub_touch_updated_at();

drop trigger if exists launchhub_form_configs_touch_updated_at
  on public.launchhub_form_configs;
create trigger launchhub_form_configs_touch_updated_at
before update on public.launchhub_form_configs
for each row execute function public.launchhub_touch_updated_at();

drop trigger if exists launchhub_services_validate_scope
  on public.launchhub_services;
create trigger launchhub_services_validate_scope
before insert or update on public.launchhub_services
for each row execute function public.launchhub_validate_scope();

drop trigger if exists launchhub_packages_validate_scope
  on public.launchhub_packages;
create trigger launchhub_packages_validate_scope
before insert or update on public.launchhub_packages
for each row execute function public.launchhub_validate_scope();

drop trigger if exists launchhub_locations_validate_scope
  on public.launchhub_locations;
create trigger launchhub_locations_validate_scope
before insert or update on public.launchhub_locations
for each row execute function public.launchhub_validate_scope();

drop trigger if exists launchhub_form_configs_validate_scope
  on public.launchhub_form_configs;
create trigger launchhub_form_configs_validate_scope
before insert or update on public.launchhub_form_configs
for each row execute function public.launchhub_validate_scope();

alter table public.launchhub_services enable row level security;
alter table public.launchhub_packages enable row level security;
alter table public.launchhub_locations enable row level security;
alter table public.launchhub_form_configs enable row level security;

comment on table public.launchhub_services is
  'LaunchHub-owned service catalogue scoped by Growth OS client and brand.';
comment on table public.launchhub_packages is
  'LaunchHub-owned offer/package catalogue scoped by Growth OS client and brand.';
comment on table public.launchhub_locations is
  'LaunchHub-owned appointment/service locations scoped by Growth OS client and brand.';
comment on table public.launchhub_form_configs is
  'One-to-one LaunchHub configuration for the shared Growth OS lead_forms identity.';

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
  new_snapshot_id uuid;
  new_lead_id uuid;
begin
  if not exists (
    select 1
    from public.lead_forms f
    where f.id = p_form_id
      and f.client_id = p_client_id
      and f.brand_id = p_brand_id
      and f.form_key = p_form_key
      and f.is_active = true
  ) then
    raise exception 'launchhub_form_scope_invalid';
  end if;

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
    p_client_key,
    p_brand_key,
    p_form_key,
    p_is_test_data
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
    p_location_name,
    p_service_name,
    p_payment_status,
    coalesce(p_raw_form_data, '{}'::jsonb),
    p_client_key,
    p_brand_key,
    p_form_key,
    p_treatment_price,
    p_treatment_price_label,
    p_is_test_data
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
