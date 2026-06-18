import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { StatCard } from "@/components/alyssa/ui";
import {
  asNumber,
  getLeadRows,
  money,
  type LeadRow,
} from "@/lib/data/businessMetrics";
import { getConfigurationData } from "@/lib/data/configuration";
import { getLandingPageList } from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";

async function getDashboardOverview() {
  const [today, week, config, landingPages] = await Promise.all([
    getLeadRows("today", 5000),
    getLeadRows("last7", 5000),
    getConfigurationData(),
    getLandingPageList(),
  ]);
  const weekLeads = week.leads;
  const latestLeadAt = weekLeads[0]?.created_at ?? today.leads[0]?.created_at ?? null;
  const latestPageAt =
    landingPages.pages
      .map((page) => page.updatedAt || page.publishedAt || page.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    todayLeads: today.leads.length,
    weekLeads,
    weekLeadCount: weekLeads.length,
    publishedLandingPages: landingPages.pages.filter(
      (page) => page.status === "published"
    ).length,
    formCount: config.forms.length,
    latestUpdate: latestLeadAt || latestPageAt,
    estimatedAmount: weekLeads.reduce(
      (sum, lead) => sum + asNumber(lead.price),
      0
    ),
    errorMessage:
      today.error || week.error
        ? "部分 LaunchHub 數據暫時未能載入。你可以先檢查 Supabase 設定，或繼續使用 config-backed 工作台。"
        : null,
  };
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Dashboard / 總覽</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Campaign 啟動與 Lead Capture OS
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                監察 Campaign forms、Landing Pages、最新 Lead 及來源證據。
                部分設定頁目前屬於 config-backed / save-ready 狀態，會於後續
                LaunchHub 階段逐步變成完整 DB-backed。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryAction href="/campaigns/new">
                建立 Campaign 流程
              </PrimaryAction>
              <SecondaryAction href="/leads">查看 Leads</SecondaryAction>
              <SecondaryAction href="/landing-pages">
                Landing Pages
              </SecondaryAction>
            </div>
          </div>

          {overview.errorMessage && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {overview.errorMessage}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="今日 Leads" value={overview.todayLeads.toString()} />
          <KpiCard label="近 7 日 Leads" value={overview.weekLeadCount.toString()} />
          <KpiCard
            label="已發布 Landing Pages"
            value={overview.publishedLandingPages.toString()}
          />
          <KpiCard label="啟用 Forms" value={overview.formCount.toString()} />
          <KpiCard
            label="最新活動"
            value={formatShortDateTime(overview.latestUpdate)}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <MotionReveal delay={0.08}>
            <LatestLeadsTable leads={overview.weekLeads.slice(0, 6)} />
          </MotionReveal>

          <MotionReveal delay={0.14}>
            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">Booking request value</p>
              <p className="mt-3 text-4xl font-bold text-slate-950">
                {money(overview.estimatedAmount)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                近 7 日提交 Lead 估算 package value。價錢由 server-side
                package configuration 讀取，不信任 public form 提交嘅價格欄位。
              </p>
              <div className="mt-5 grid gap-3">
                <SecondaryAction href="/performance">查看成效</SecondaryAction>
                <SecondaryAction href="/settings#brand-library">
                  開啟品牌資料庫
                </SecondaryAction>
              </div>
            </section>
          </MotionReveal>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="alyssa-kicker">下一步</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              選擇最快收 Lead 嘅 Campaign 入口
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <LaunchCard
              title="建立 Form 及 Campaign Page"
              body="需要 Landing Page 加登記表格時，使用 guided launch flow 一次過準備投放入口。"
            />
            <LaunchCard
              title="產生 Wix Embed"
              body="如果 Wix 已經負責頁面內容，就用 form-only mode，由 LaunchHub 處理 UTM、Source Snapshot 及 Lead capture。"
            />
            <LaunchCard
              title="檢查來源證據"
              body="用 Leads 及成效頁確認登記記錄、Source Snapshot、booking request 狀態及資料完整度。"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <MotionReveal>
      <StatCard label={label} value={value} />
    </MotionReveal>
  );
}

function PrimaryAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}

function SecondaryAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
    >
      {children}
    </Link>
  );
}

function LaunchCard({ title, body }: { title: string; body: string }) {
  return (
    <MotionReveal>
      <Link
        href="/campaigns/new"
        className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
      >
        <h3 className="text-xl font-bold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </Link>
    </MotionReveal>
  );
}

function LatestLeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <section className="alyssa-premium-card min-w-0 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="alyssa-kicker">最新 Leads</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            最近登記記錄
          </h2>
        </div>
        <Link
          href="/leads"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          查看全部
        </Link>
      </div>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="alyssa-table min-w-[780px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              {["提交時間", "客戶", "電話", "品牌", "療程 / Package", "狀態"].map(
                (heading) => (
                  <th key={heading} className="border-b border-slate-200 px-3 py-3">
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {leads.length > 0 ? (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="align-top text-slate-700 transition hover:bg-sky-50/70"
                >
                  <td className="border-b border-slate-100 px-3 py-3">
                    {formatShortDateTime(lead.created_at)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.customer_name || lead.contact?.customer_name || "未填寫"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.phone || lead.normalized_phone || lead.contact?.phone || "未填寫"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.brand?.name || "Config-backed"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.treatment?.name || "Config-backed"}
                    <span className="block font-bold text-slate-950">
                      {lead.package?.name || "Package"} ・{" "}
                      {money(asNumber(lead.price), lead.currency || "HKD")}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                      {leadStatusLabel(lead)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  目前期間未有 Lead 登記記錄。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function leadStatusLabel(lead: LeadRow) {
  const bookingStatus = lead.booking?.booking_status || lead.booking_status;
  if (lead.payment_status === "paid") return "已付款";
  if (bookingStatus === "confirmed") return "已確認 Booking";
  if (lead.payment_status === "booking_only") return "已提交 Booking request";
  if (lead.payment_status === "pending") return "待付款";
  if (lead.lead_status === "lost") return "已流失";
  if (lead.lead_status === "submitted") return "已提交";
  return "新登記";
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "暫未有活動";

  return new Intl.DateTimeFormat("zh-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}
