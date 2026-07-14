-- Growth OS LaunchHub source snapshot immutability
-- Apply after the LaunchHub data contract and security-review migrations.

begin;

create or replace function public.launchhub_enforce_snapshot_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'lead_id') is distinct from (to_jsonb(old) - 'lead_id') then
    raise exception 'launchhub_source_snapshot_immutable';
  end if;

  if new.lead_id is distinct from old.lead_id then
    if old.lead_id is not null or new.lead_id is null then
      raise exception 'launchhub_source_snapshot_lead_link_immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists launchhub_source_snapshot_immutability
  on public.lead_source_snapshots;
create trigger launchhub_source_snapshot_immutability
before update on public.lead_source_snapshots
for each row execute function public.launchhub_enforce_snapshot_immutability();

revoke execute on function public.launchhub_enforce_snapshot_immutability()
  from public, anon, authenticated;

commit;
