-- Growth OS-native Landing Page Builder persistence.
-- This migration deliberately contains no tenant seed data.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'landing_page_mode') then
    create type public.landing_page_mode as enum ('form_only', 'landing_page');
  end if;

  if not exists (select 1 from pg_type where typname = 'landing_page_status') then
    create type public.landing_page_status as enum ('draft', 'published', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'landing_page_version_status') then
    create type public.landing_page_version_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  treatment_id uuid null references public.launchhub_services(id) on delete set null,
  package_id uuid null references public.launchhub_packages(id) on delete set null,
  branch_id uuid null references public.launchhub_locations(id) on delete set null,
  form_id uuid null references public.lead_forms(id) on delete set null,
  slug text not null unique,
  title text not null,
  template_key text not null,
  mode public.landing_page_mode not null default 'landing_page',
  status public.landing_page_status not null default 'draft',
  content_json jsonb not null default '{}'::jsonb,
  image_assets_json jsonb not null default '{}'::jsonb,
  published_version_id uuid null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landing_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.landing_pages(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.landing_page_version_status not null default 'draft',
  content_json jsonb not null default '{}'::jsonb,
  image_assets_json jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, version_number)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'landing_pages_published_version_id_fkey'
  ) then
    alter table public.landing_pages
      add constraint landing_pages_published_version_id_fkey
      foreign key (published_version_id)
      references public.landing_page_versions(id)
      on delete set null;
  end if;
end $$;

create or replace function public.validate_launchhub_landing_page_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  related_client_id uuid;
  related_brand_id uuid;
begin
  select client_id into related_client_id
  from public.brands
  where id = new.brand_id;

  if related_client_id is null or related_client_id <> new.client_id then
    raise exception 'landing page client/brand scope mismatch';
  end if;

  if new.treatment_id is not null then
    select client_id, brand_id into related_client_id, related_brand_id
    from public.launchhub_services where id = new.treatment_id;
    if related_client_id <> new.client_id or related_brand_id <> new.brand_id then
      raise exception 'landing page service scope mismatch';
    end if;
  end if;

  if new.package_id is not null then
    select client_id, brand_id into related_client_id, related_brand_id
    from public.launchhub_packages where id = new.package_id;
    if related_client_id <> new.client_id or related_brand_id <> new.brand_id then
      raise exception 'landing page package scope mismatch';
    end if;
  end if;

  if new.branch_id is not null then
    select client_id, brand_id into related_client_id, related_brand_id
    from public.launchhub_locations where id = new.branch_id;
    if related_client_id <> new.client_id or related_brand_id <> new.brand_id then
      raise exception 'landing page location scope mismatch';
    end if;
  end if;

  if new.form_id is not null then
    select client_id, brand_id into related_client_id, related_brand_id
    from public.lead_forms where id = new.form_id;
    if related_client_id <> new.client_id or related_brand_id <> new.brand_id then
      raise exception 'landing page form scope mismatch';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists landing_pages_validate_scope on public.landing_pages;
create trigger landing_pages_validate_scope
before insert or update on public.landing_pages
for each row execute function public.validate_launchhub_landing_page_scope();

create index if not exists landing_pages_scope_status_updated_idx
  on public.landing_pages(client_id, brand_id, status, updated_at desc);
create index if not exists landing_pages_status_slug_idx
  on public.landing_pages(status, slug);
create index if not exists landing_page_versions_page_status_idx
  on public.landing_page_versions(page_id, status, version_number desc);

alter table public.landing_pages enable row level security;
alter table public.landing_page_versions enable row level security;

revoke all on table public.landing_pages from anon, authenticated;
revoke all on table public.landing_page_versions from anon, authenticated;
revoke execute on function public.validate_launchhub_landing_page_scope() from public, anon, authenticated;

grant all on table public.landing_pages to service_role;
grant all on table public.landing_page_versions to service_role;
grant execute on function public.validate_launchhub_landing_page_scope() to service_role;

notify pgrst, 'reload schema';
