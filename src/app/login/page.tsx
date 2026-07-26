import Link from "next/link";
import { loginAction } from "@/app/login/actions";
import {
  getAdminPasswordGateWarning,
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/logout")) return "/dashboard";
  return raw;
}

function getKairvoEntryUrl(next: string) {
  const base =
    process.env.GROWTH_OS_PLATFORM_URL?.trim().replace(/\/+$/, "") ||
    "https://leadhub-source-os.vercel.app";
  const url = new URL("/launchhub", base);
  url.searchParams.set("next", next);
  return url.toString();
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query?.next);
  const error = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const warning = getAdminPasswordGateWarning();
  const gateEnabled = isAdminPasswordGateEnabled();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#e0f2fe_0,#f8fafc_38%,#eef6ff_100%)] px-5 py-10 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl place-items-center">
        <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white/92 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">
              Kairvo LaunchHub
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              Recovery Access
            </h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              正常情況請由 Kairvo 登入並開啟 LaunchHub。共用 Recovery Password 只用於 SSO 或 Cookie 故障時嘅受控後備登入。
            </p>
          </div>

          <Link
            href={getKairvoEntryUrl(next)}
            className="mt-6 flex w-full items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(2,132,199,0.2)] transition hover:-translate-y-0.5 hover:bg-sky-700"
          >
            返回 Kairvo 登入
          </Link>

          <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            Recovery fallback
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {warning && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              {warning}
            </p>
          )}

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error === "invalid_password"
                ? "Recovery Password 不正確，請再試一次。"
                : error === "sso_session_unavailable"
                  ? "瀏覽器未能保存 Kairvo 登入狀態。請先檢查 Cookie 設定；只有受權限管理嘅操作人員先應使用 Recovery Password。"
                  : "暫時未能開啟 LaunchHub，請稍後再試。"}
            </p>
          )}

          <form action={loginAction} className="mt-5 grid gap-4">
            <input type="hidden" name="next" value={next} />
            {gateEnabled && (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Recovery Password
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            )}
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              {gateEnabled ? "使用 Recovery Access" : "進入 LaunchHub"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
