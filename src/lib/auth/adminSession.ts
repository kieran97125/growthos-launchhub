import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const LAUNCHHUB_ACCESS_COOKIE = "growthos_launchhub_access";
export const LAUNCHHUB_REFRESH_COOKIE = "growthos_launchhub_refresh";

const ADMIN_ROLES = new Set(["master_admin"]);

type AdminProfile = {
  id: string;
  email: string;
  fullName: string | null;
  globalRole: string;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

async function getAuthorizedProfile(userId: string): Promise<AdminProfile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,global_role,status")
    .eq("id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data || !ADMIN_ROLES.has(String(data.global_role))) {
    return null;
  }

  return {
    id: String(data.id),
    email: String(data.email),
    fullName: typeof data.full_name === "string" ? data.full_name : null,
    globalRole: String(data.global_role),
  };
}

export async function setLaunchHubSessionCookies(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}) {
  const store = await cookies();
  store.set(
    LAUNCHHUB_ACCESS_COOKIE,
    input.accessToken,
    cookieOptions(Math.max(60, (input.expiresIn ?? 3600) - 30))
  );
  store.set(
    LAUNCHHUB_REFRESH_COOKIE,
    input.refreshToken,
    cookieOptions(60 * 60 * 24 * 30)
  );
}

export async function clearLaunchHubSessionCookies() {
  const store = await cookies();
  store.set(LAUNCHHUB_ACCESS_COOKIE, "", cookieOptions(0));
  store.set(LAUNCHHUB_REFRESH_COOKIE, "", cookieOptions(0));
}

export async function signInLaunchHubAdmin(email: string, password: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.session || !data.user) {
    return { ok: false as const, message: "電郵或密碼不正確。" };
  }

  const profile = await getAuthorizedProfile(data.user.id);
  if (!profile) {
    return { ok: false as const, message: "此帳戶未獲 LaunchHub 管理權限。" };
  }

  await setLaunchHubSessionCookies({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  });

  return { ok: true as const, profile };
}

export async function getLaunchHubAdminSession(): Promise<AdminProfile | null> {
  const store = await cookies();
  const accessToken = store.get(LAUNCHHUB_ACCESS_COOKIE)?.value || "";
  if (!accessToken) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return getAuthorizedProfile(data.user.id);
}

export async function requireLaunchHubAdmin() {
  const profile = await getLaunchHubAdminSession();
  if (!profile) {
    throw new Error("launchhub_admin_session_required");
  }
  return profile;
}
