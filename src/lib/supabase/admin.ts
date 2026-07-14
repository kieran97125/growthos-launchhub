import { createClient } from "@supabase/supabase-js";

const DEFAULT_GROWTH_OS_SUPABASE_PROJECT_REF = "mlubmmandwzvepqolngg";

function getConfiguredSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

function getExpectedGrowthOsProjectRef() {
  return (
    process.env.GROWTHOS_EXPECTED_SUPABASE_PROJECT_REF?.trim() ||
    DEFAULT_GROWTH_OS_SUPABASE_PROJECT_REF
  );
}

export function getSupabaseProjectRef(url = getConfiguredSupabaseUrl()) {
  if (!url) return "";

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(hostname);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

export function getSupabaseBoundaryStatus() {
  const configuredUrl = getConfiguredSupabaseUrl();
  const configuredProjectRef = getSupabaseProjectRef(configuredUrl);
  const expectedProjectRef = getExpectedGrowthOsProjectRef();

  return {
    configured: Boolean(
      configuredUrl && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ),
    configuredProjectRef,
    expectedProjectRef,
    matchesExpectedProject:
      Boolean(configuredProjectRef) && configuredProjectRef === expectedProjectRef,
  };
}

export function hasSupabaseAdminEnv() {
  return getSupabaseBoundaryStatus().configured;
}

export function assertGrowthOsSupabaseOwnership() {
  const boundary = getSupabaseBoundaryStatus();

  if (!boundary.configured) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }

  if (!boundary.matchesExpectedProject) {
    throw new Error(
      `growthos_supabase_boundary_mismatch: expected ${boundary.expectedProjectRef}, received ${
        boundary.configuredProjectRef || "invalid_project_ref"
      }`
    );
  }

  return boundary;
}

export function createSupabaseAdminClient() {
  assertGrowthOsSupabaseOwnership();

  const url = getConfiguredSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
