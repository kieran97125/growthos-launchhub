import Link from "next/link";
import { AppNav } from "@/components/layout/AppNav";
import { SettingsNav } from "@/components/layout/SettingsNav";

function getKairvoAdminUrl() {
  const base =
    process.env.GROWTH_OS_PLATFORM_URL?.trim().replace(/\/+$/, "") ||
    "https://leadhub-source-os.vercel.app";
  return `${base}/?tab=admin`;
}

export default function TeamAccessSettingsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Kairvo Platform Control
          </p>
          <h1 className="mt-2 text-3xl font-bold">團隊與 App 權限</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            LaunchHub 不再保存另一套臨時角色或假權限。用戶、Client、Brand、角色同逐人 App Access 全部由 Kairvo Master Admin 統一管理，避免兩套權限互相衝突。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_100%)] p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-xl font-bold">前往 User App Access Matrix</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                先喺 Platform Access 開通 Client／Brand 可用嘅 Apps，再喺 User App Access Matrix 分配每位成員可使用 GrowthRadar、LaunchHub、CRM、Demand Signals 同 AI Creative。
              </p>
            </div>
            <Link
              href={getKairvoAdminUrl()}
              className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Open Kairvo Master Admin
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
