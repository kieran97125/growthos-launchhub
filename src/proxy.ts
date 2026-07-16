import { NextResponse, type NextRequest } from "next/server";
import { isInternalRoute } from "@/lib/security/routeBoundary";
import {
  adminSessionCookieName,
  isAdminPasswordGateEnabled,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

const SSO_RECOVERY_MARKER = "launchhub_sso_recovered";

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate"
  );
  response.headers.set("Vary", "Cookie");
  return response;
}

function cleanBaseUrl(value: string | undefined) {
  const cleaned = value?.trim().replace(/\/+$/, "");
  return cleaned || null;
}

function originFromBaseUrl(value: string | undefined) {
  const configured = cleanBaseUrl(value);
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

function getRequestHost(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  return host.split(",")[0]?.trim().toLowerCase() || request.nextUrl.host;
}

function getRequestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0];
  const proto = forwardedProto?.trim() || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${getRequestHost(request)}`;
}

function shouldUseAdminOrigin(request: NextRequest) {
  if (process.env.LAUNCHHUB_SPLIT_ORIGIN_ENABLED !== "true") return null;

  const adminOrigin = originFromBaseUrl(process.env.NEXT_PUBLIC_ADMIN_BASE_URL);
  const publicOrigin = originFromBaseUrl(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL);
  if (!adminOrigin || !publicOrigin) return null;
  if (getRequestOrigin(request) !== publicOrigin) return null;
  if (getRequestOrigin(request) === adminOrigin) return null;
  return adminOrigin;
}

function redirectToAdminOrigin(request: NextRequest, adminOrigin: string) {
  return privateRedirect(
    new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, adminOrigin)
  );
}

function isAdminBackendPath(pathname: string) {
  return pathname === "/login" || pathname === "/logout" || isInternalRoute(pathname);
}

function redirectToGrowthOsSso(request: NextRequest) {
  const growthOsOrigin =
    originFromBaseUrl(process.env.GROWTH_OS_PLATFORM_URL) ||
    "https://leadhub-source-os.vercel.app";
  const bridge = new URL("/launchhub", growthOsOrigin);
  const cleanUrl = cleanRecoveryMarker(request);
  bridge.searchParams.set("next", `${cleanUrl.pathname}${cleanUrl.search}`);
  return privateRedirect(bridge);
}

function cleanRecoveryMarker(request: NextRequest) {
  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete(SSO_RECOVERY_MARKER);
  return cleanUrl;
}

function redirectToFallbackLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  const nextUrl = cleanRecoveryMarker(request);
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}`);
  loginUrl.searchParams.set("error", "sso_session_unavailable");
  return privateRedirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  if (isAdminBackendPath(request.nextUrl.pathname)) {
    const adminOrigin = shouldUseAdminOrigin(request);
    if (adminOrigin) return redirectToAdminOrigin(request, adminOrigin);
  }

  if (
    isAdminPasswordGateEnabled() &&
    isInternalRoute(request.nextUrl.pathname)
  ) {
    const session = await verifySignedAdminSession(
      request.cookies.get(adminSessionCookieName)?.value
    );

    if (!session.ok) {
      return request.nextUrl.searchParams.has(SSO_RECOVERY_MARKER)
        ? redirectToFallbackLogin(request)
        : redirectToGrowthOsSso(request);
    }

    if (request.nextUrl.searchParams.has(SSO_RECOVERY_MARKER)) {
      return privateRedirect(cleanRecoveryMarker(request));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
