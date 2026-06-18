import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";

const homeCards = [
  {
    href: "/campaigns/new",
    eyebrow: "Campaign Builder",
    title: "建立 Campaign 流程",
    body: "由 Campaign form、Landing Page 模式到來源捕捉設定，一個流程準備好投放入口。",
  },
  {
    href: "/forms",
    eyebrow: "Lead Capture",
    title: "管理 Forms 與 Wix Embed",
    body: "建立可重用登記表格、Public Token 及 Wix embed snippet，方便每個品牌快速收 Lead。",
  },
  {
    href: "/landing-pages",
    eyebrow: "Campaign Pages",
    title: "啟動 Landing Pages",
    body: "將 offer、療程角度及表格包裝成 Campaign 測試頁，不取代主網站。",
  },
  {
    href: "/settings#brand-library",
    eyebrow: "Configuration",
    title: "設定品牌範圍",
    body: "管理品牌、療程、package、分店及 form 預設值，確保每次 Campaign 啟動前資料一致。",
  },
];

export default function HomePage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_48%,#eaf6ff_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="alyssa-kicker">LaunchHub</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
                Campaign 啟動與 Lead Capture OS
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                建立 Campaign form、Wix embed、Landing Page、UTM 捕捉及
                Lead Source Snapshot，作為品牌收 Lead 同記錄來源證據嘅入口。
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
                適合香港 SME、美容及醫美品牌用作投放前置工作台：整理品牌設定、建立表格、
                保存來源證據，然後將後續成效分析交俾 GrowthRadar。
              </p>
            </div>

            <div className="rounded-3xl border border-sky-100 bg-white/88 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                Product Boundary
              </p>
              <h2 className="mt-3 text-xl font-bold text-slate-950">
                先收 Lead，後分析成效
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                LaunchHub 負責 Campaign capture、Embed、Form Token 及
                Source Snapshot；GrowthRadar 負責後續成效分析、Source Quality
                及 Monthly Report。
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/campaigns/new"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              建立 Campaign 流程
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-sky-50"
            >
              開啟 Dashboard
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {homeCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
            >
              <p className="alyssa-kicker">{card.eyebrow}</p>
              <h2 className="mt-3 text-xl font-bold text-slate-950">
                {card.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {card.body}
              </p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
