import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieName,
  adminSessionMaxAgeSeconds,
  createSignedAdminSession,
} from "@/lib/security/internalAccess";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function redirectUrl(request: NextRequest, pathname: string, reason?: string) {
  const url = new URL(pathname, request.url);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim() || "";
  if (!/^[0-9a-f]{64}$/.test(code)) {
    return redirectUrl(request, "/login", "invalid_sso_code");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consume_launchhub_sso_code", {
    p_code: code,
  });

  const consumed = Array.isArray(data) ? data[0] : data;
  if (error || !consumed?.user_id) {
    return redirectUrl(request, "/login", "expired_or_used_sso_code");
  }

  const session = await createSignedAdminSession();
  if (!session) {
    return redirectUrl(request, "/login", "session_configuration_missing");
  }

  const target = request.nextUrl.searchParams.get("next") || "/";
  const safeTarget = target.startsWith("/") && !target.startsWith("//") ? target : "/";
  const response = redirectUrl(request, safeTarget);

  response.cookies.set(adminSessionCookieName, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds,
  });

  return response;
}
