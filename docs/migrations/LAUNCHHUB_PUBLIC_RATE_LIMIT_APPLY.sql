-- Kairvo LaunchHub public submission hardening.
-- Stores only HMAC fingerprints; no raw IP address, phone number or form token.

create table if not exists public.launchhub_public_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now(),
  constraint launchhub_public_rate_limits_key_hash_check
    check (key_hash ~ '^[0-9a-f]{64}$')
);

alter table public.launchhub_public_rate_limits enable row level security;
revoke all on public.launchhub_public_rate_limits from anon, authenticated;
grant all on public.launchhub_public_rate_limits to service_role;

create index if not exists launchhub_public_rate_limits_updated_idx
  on public.launchhub_public_rate_limits (updated_at);

create or replace function public.launchhub_check_public_rate_limit(
  p_key_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 180
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count integer;
  v_now timestamptz := now();
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_rate_limit_key' using errcode = '22023';
  end if;

  if p_limit < 1 or p_limit > 100 or p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_policy' using errcode = '22023';
  end if;

  insert into public.launchhub_public_rate_limits (
    key_hash,
    window_started_at,
    attempt_count,
    updated_at
  ) values (
    p_key_hash,
    v_now,
    1,
    v_now
  )
  on conflict (key_hash)
  do update set
    window_started_at = case
      when public.launchhub_public_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then v_now
      else public.launchhub_public_rate_limits.window_started_at
    end,
    attempt_count = case
      when public.launchhub_public_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then 1
      else public.launchhub_public_rate_limits.attempt_count + 1
    end,
    updated_at = v_now
  returning attempt_count into v_attempt_count;

  -- Keep the table bounded without exposing a public cleanup endpoint.
  delete from public.launchhub_public_rate_limits
  where updated_at < v_now - interval '2 days';

  return v_attempt_count <= p_limit;
end;
$$;

revoke all on function public.launchhub_check_public_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.launchhub_check_public_rate_limit(text, integer, integer)
  to service_role;
