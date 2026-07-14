import { cookies } from "next/headers";

function cookieName(formId: string) {
  return `launchhub_token_reveal_${formId}`;
}

export async function setOneTimeFormToken(formId: string, token: string) {
  const store = await cookies();
  store.set(cookieName(formId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/forms/${formId}`,
    maxAge: 60 * 10,
  });
}

export async function getOneTimeFormToken(formId: string) {
  const store = await cookies();
  return store.get(cookieName(formId))?.value || "";
}
