-- Growth OS LaunchHub foreign-key support indexes
-- Apply after the LaunchHub data contract migration.

begin;

create index if not exists launchhub_services_brand_fk_idx
  on public.launchhub_services(brand_id);

create index if not exists launchhub_packages_brand_fk_idx
  on public.launchhub_packages(brand_id);
create index if not exists launchhub_packages_service_fk_idx
  on public.launchhub_packages(service_id);

create index if not exists launchhub_locations_brand_fk_idx
  on public.launchhub_locations(brand_id);

create index if not exists launchhub_form_configs_brand_fk_idx
  on public.launchhub_form_configs(brand_id);
create index if not exists launchhub_form_configs_default_service_fk_idx
  on public.launchhub_form_configs(default_service_id);
create index if not exists launchhub_form_configs_default_package_fk_idx
  on public.launchhub_form_configs(default_package_id);
create index if not exists launchhub_form_configs_default_location_fk_idx
  on public.launchhub_form_configs(default_location_id);

commit;
