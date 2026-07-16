import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/login/actions";
import {
  getAdminPasswordGateWarning,
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/logout") || raw.startsWith("/sso")) {
    return "/dashboard";
  }
  return raw;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    next?: string | string[];
    error?: string | string[];
    reason?: string | string[];
    manual?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(query?.next);
  const error = first(query?.error);
  const reason = first(query?.reason);
  const manual = first(query?.manual) === "1";
  const configurationFailure = reason === "session_configuration_missing";

  if (!manual && !configurationFailure) {
    const bridge = new URL(
      "/launchhub-bridge",
      process.env.NEXT_PUBLIC_GROWTH_OS_APP_URL ||
        "https://leadhub-source-os.vercel.app"
    );
    bridge.searchParams.set("next", next);
    redirect(bridge.toString());
  }

  const warning = getAdminPasswordGateWarning();
  const gateEnabled = isAdminPasswordGateEnabled();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,#e0f2fe_0,#f8fafc_38%,#eef6ff_100%)] px-5 py-10 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl place-items-center">
        <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white/92 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">
              LaunchHub Recovery Access
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              手動管理員登入
            </h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              正常情況會使用 Growth OS 單一登入。只有平台連接故障時先需要使用呢個後備入口。
            </p>
          </div>

          {(warning || configurationFailure) && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              {configurationFailure
                ? "LaunchHub session 設定暫時不可用。"
                : warning}
            </p>
          )}

          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error === "invalid_password"
                ? "Password 不正確，請再試一次。"
                : "暫時未能開啟 admin 工作台，請稍後再試。"}
            </p>
          )}

          <form action={loginAction} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            {gateEnabled && (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                  Admin Password
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
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              {gateEnabled ? "使用後備登入" : "進入 Admin 工作台"}
            </button>
          </form>

          <Link
            href={`https://leadhub-source-os.vercel.app/launchhub-bridge?next=${encodeURIComponent(
              next
            )}`}
            className="mt-4 block text-center text-sm font-bold text-sky-700"
          >
            返回 Growth OS 單一登入
          </Link>
        </div>
      </section>
    </main>
  );
}
