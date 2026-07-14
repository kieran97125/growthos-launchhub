-- LaunchHub derived success redirect backfill review.
--
-- REVIEW ONLY. This file defaults to ROLLBACK.
-- Do not replace the final ROLLBACK with COMMIT until the preview rows have
-- been checked and the application branch has been deployed.
--
-- This script changes only forms using thank_you_redirect whose stored
-- treatment or value query parameter no longer matches the selected
-- treatment/package configuration.

begin;

with form_config as (
  select
    f.id,
    f.public_form_token,
    f.form_name,
    b.name as brand_name,
    b.default_thank_you_url,
    t.slug as treatment_slug,
    coalesce(p.promo_price, p.original_price) as expected_value,
    f.success_redirect_url,
    substring(f.success_redirect_url from '(?:[?&])treatment=([^&#]+)') as stored_treatment,
    substring(f.success_redirect_url from '(?:[?&])value=([^&#]+)') as stored_value
  from public.forms f
  join public.brands b on b.id = f.brand_id
  join public.treatments t on t.id = f.default_treatment_id
  join public.packages p on p.id = f.default_package_id
  where f.conversion_mode = 'thank_you_redirect'
),
preview as (
  select
    id,
    public_form_token,
    form_name,
    brand_name,
    success_redirect_url as old_success_redirect_url,
    format(
      '%s?submitted=1&treatment=%s&value=%s',
      regexp_replace(default_thank_you_url, '[?].*$', ''),
      treatment_slug,
      round(expected_value)::text
    ) as new_success_redirect_url
  from form_config
  where default_thank_you_url is not null
    and treatment_slug is not null
    and expected_value is not null
    and (
      success_redirect_url is null
      or stored_treatment is distinct from treatment_slug
      or stored_value is distinct from round(expected_value)::text
    )
)
select *
from preview
order by brand_name, form_name;

-- Deliberate repair statement. Keep this inside the transaction and inspect
-- the RETURNING rows before deciding whether to commit.
with form_config as (
  select
    f.id,
    b.default_thank_you_url,
    t.slug as treatment_slug,
    coalesce(p.promo_price, p.original_price) as expected_value,
    f.success_redirect_url,
    substring(f.success_redirect_url from '(?:[?&])treatment=([^&#]+)') as stored_treatment,
    substring(f.success_redirect_url from '(?:[?&])value=([^&#]+)') as stored_value
  from public.forms f
  join public.brands b on b.id = f.brand_id
  join public.treatments t on t.id = f.default_treatment_id
  join public.packages p on p.id = f.default_package_id
  where f.conversion_mode = 'thank_you_redirect'
),
repair as (
  select
    id,
    format(
      '%s?submitted=1&treatment=%s&value=%s',
      regexp_replace(default_thank_you_url, '[?].*$', ''),
      treatment_slug,
      round(expected_value)::text
    ) as new_success_redirect_url
  from form_config
  where default_thank_you_url is not null
    and treatment_slug is not null
    and expected_value is not null
    and (
      success_redirect_url is null
      or stored_treatment is distinct from treatment_slug
      or stored_value is distinct from round(expected_value)::text
    )
)
update public.forms as f
set
  success_redirect_url = repair.new_success_redirect_url,
  updated_at = now()
from repair
where f.id = repair.id
returning
  f.id,
  f.public_form_token,
  f.form_name,
  f.success_redirect_url,
  f.updated_at;

-- Safety default.
rollback;
