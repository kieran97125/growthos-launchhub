-- Growth OS LaunchHub data contract v1 hardening
-- REVIEW REQUIRED. Apply after 20260714_launchhub_data_contract_v1.sql.

begin;

-- Public form tokens are capability credentials. Two active forms must never
-- resolve from the same token hash.
drop index if exists public.lead_forms_public_token_hash_idx;
create unique index if not exists lead_forms_public_token_hash_unique_idx
  on public.lead_forms(public_form_token_hash)
  where is_active = true;

-- Supports the server-side three-minute duplicate submission check.
create index if not exists leads_launchhub_duplicate_window_idx
  on public.leads(client_id, brand_id, form_key, phone, created_at desc);

-- Redirect bases may be an absolute HTTP(S) URL or a same-origin relative path.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'launchhub_form_configs_redirect_base_check'
  ) then
    alter table public.launchhub_form_configs
      add constraint launchhub_form_configs_redirect_base_check
      check (
        success_redirect_base_url is null
        or success_redirect_base_url = ''
        or success_redirect_base_url ~ '^https?://'
        or success_redirect_base_url like '/%'
      );
  end if;
end;
$$;

-- Trigger helpers are implementation details, not callable application APIs.
revoke execute on function public.launchhub_touch_updated_at()
  from public, anon, authenticated;
revoke execute on function public.launchhub_validate_scope()
  from public, anon, authenticated;

commit;
