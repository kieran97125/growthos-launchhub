import { cookies } from "next/headers";
import {
  adminSessionCookieName,
  adminSessionMaxAgeSeconds,
  createSignedAdminSession,
  isAdminPasswordGateEnabled,
  legacyInternalSessionCookieName,
  verifySignedAdminSession,
  type InternalAccessContext,
  type InternalAction,
  type InternalModule,
} from "@/lib/security/internalAccess";

function openAccessContext(): InternalAccessContext {
  return {
    source: "development_not_configured",
  };
}

async function readSessionVerification() {
  if (!isAdminPasswordGateEnabled()) {
    return {
      ok: true,
      source: "development_not_configured" as const,
      reason: null,
    };
  }

  const cookieStore = await cookies();
  return verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
  );
}

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
  const result = await readSessionVerification();

  return result.ok && result.source
    ? { source: result.source }
    : openAccessContext();
}

export async function hasVerifiedAdminSession() {
  const result = await readSessionVerification();
  return result.ok;
}

export async function setAdminSessionCookie() {
  const session = await createSignedAdminSession();
  if (!session) return false;

  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieName, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds,
  });

  return true;
}

export async function clearInternalSessionCookie() {
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  } as const;

  cookieStore.set(adminSessionCookieName, "", cookieOptions);
  cookieStore.set(legacyInternalSessionCookieName, "", cookieOptions);
}

export async function requireModuleAccess(_module: InternalModule) {
  void _module;
  const allowed = await hasVerifiedAdminSession();

  return {
    access: await getCurrentInternalAccess(),
    allowed,
  };
}

export async function requireActionAccess(_action: InternalAction) {
  void _action;
  const allowed = await hasVerifiedAdminSession();

  return {
    access: await getCurrentInternalAccess(),
    allowed,
  };
}
