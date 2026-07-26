import type { InternalModule } from "@/lib/security/internalAccess";

export const publicExactRoutes = [
  "/login",
  "/logout",
  "/sso",
  "/thank-you",
] as const;

export const publicRoutePrefixes = [
  "/lp/",
  "/embed/",
  "/legal/",
  "/api/public/",
  "/api/webhooks/",
] as const;

const internalModulePrefixes: Array<{
  prefix: string;
  module: InternalModule;
}> = [
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/leads", module: "leads" },
  { prefix: "/performance", module: "performance" },
  { prefix: "/campaigns", module: "campaigns" },
  { prefix: "/create-campaign", module: "campaigns" },
  { prefix: "/forms", module: "forms" },
  { prefix: "/embed-preview", module: "forms" },
  { prefix: "/landing-pages", module: "landing_pages" },
  { prefix: "/settings/brands", module: "brands" },
  { prefix: "/settings", module: "settings" },
  { prefix: "/system-audit", module: "system_audit" },
];

function isE2eFixtureRoute(pathname: string) {
  return pathname.startsWith("/e2e/");
}

export function isPublicRoute(pathname: string) {
  // The fixture page itself calls notFound() unless LAUNCHHUB_E2E_FIXTURES=1.
  // Let it return a real 404 instead of leaking the internal SSO recovery flow.
  if (isE2eFixtureRoute(pathname)) return true;

  return (
    publicExactRoutes.includes(pathname as (typeof publicExactRoutes)[number]) ||
    publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isInternalRoute(pathname: string) {
  // Explicit public/webhook routes are the only exceptions. Every new UI or API
  // route fails closed until it is deliberately classified as public.
  return !isPublicRoute(pathname);
}

export function getInternalRouteModule(pathname: string): InternalModule | null {
  if (!isInternalRoute(pathname)) return null;
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";

  return (
    internalModulePrefixes.find(
      ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )?.module || null
  );
}
