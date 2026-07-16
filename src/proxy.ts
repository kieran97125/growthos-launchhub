import { NextResponse, type NextRequest } from "next/server";
import { isInternalRoute } from "@/lib/security/routeBoundary";
import {
  adminSessionCookieName,
  isAdminPasswordGateEnabled,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

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

function splitOriginEnabled() {
  return process.env.LAUNCHHUB_SPLIT_ORIGIN_ENABLED === "true";
}

function shouldUseAdminOrigin(request: NextRequest) {
  if (!splitOriginEnabled()) return null;

  const adminOrigin = originFromBaseUrl(process.env.NEXT_PUBLIC_ADMIN_BASE_URL);
  const publicOrigin = originFromBaseUrl(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL);
  if (!adminOrigin || !publicOrigin) return null;
  if (getRequestOrigin(request) !== publicOrigin) return null;
  if (getRequestOrigin(request) === adminOrigin) return null;
  return adminOrigin;
}

function redirectToAdminOrigin(request: NextRequest, adminOrigin: string) {
  return NextResponse.redirect(
    new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, adminOrigin)
  );
}

function isAdminBackendPath(pathname: string) {
  return pathname === "/login" || pathname === "/logout" || isInternalRoute(pathname);
}

function growthOsOrigin() {
  return (
    originFromBaseUrl(process.env.NEXT_PUBLIC_GROWTH_OS_APP_URL) ||
    "https://leadhub-source-os.vercel.app"
  );
}

function redirectToGrowthOsBridge(request: NextRequest) {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const bridgeUrl = new URL("/launchhub-bridge", growthOsOrigin());
  bridgeUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(bridgeUrl);
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
      return redirectToGrowthOsBridge(request);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
