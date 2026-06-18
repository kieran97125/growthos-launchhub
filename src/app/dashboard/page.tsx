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
        ? "Some LaunchHub data could not be loaded. Check Supabase configuration or continue with local config-backed screens."
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
              <p className="alyssa-kicker">Launch command center</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Campaign Launch & Lead Capture OS
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Monitor campaign forms, landing pages, incoming leads and
                source evidence. Some configuration areas are save-ready and
                will become fully database-backed in later LaunchHub stages.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryAction href="/campaigns/new">
                Create campaign flow
              </PrimaryAction>
              <SecondaryAction href="/leads">View leads</SecondaryAction>
              <SecondaryAction href="/landing-pages">
                Landing pages
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
          <KpiCard label="Leads today" value={overview.todayLeads.toString()} />
          <KpiCard label="Leads this week" value={overview.weekLeadCount.toString()} />
          <KpiCard
            label="Published pages"
            value={overview.publishedLandingPages.toString()}
          />
          <KpiCard label="Active forms" value={overview.formCount.toString()} />
          <KpiCard
            label="Latest activity"
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
                Estimated package value from submitted leads in the current
                seven-day window. Prices are read from server-side package
                configuration, not trusted from public form submissions.
              </p>
              <div className="mt-5 grid gap-3">
                <SecondaryAction href="/performance">View performance</SecondaryAction>
                <SecondaryAction href="/settings#brand-library">
                  Open brand library
                </SecondaryAction>
              </div>
            </section>
          </MotionReveal>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="alyssa-kicker">Next launch steps</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Choose the fastest path to collect campaign leads
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <LaunchCard
              title="Create a form and campaign page"
              body="Use the guided launch flow when you need both a campaign landing page and a registration form."
            />
            <LaunchCard
              title="Generate a Wix embed"
              body="Use form-only mode when Wix owns the page and LaunchHub only handles capture, UTM and source evidence."
            />
            <LaunchCard
              title="Review source evidence"
              body="Use leads and performance screens to confirm submissions, source snapshots and booking request status."
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
          <p className="alyssa-kicker">Latest leads</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Recent capture activity
          </h2>
        </div>
        <Link
          href="/leads"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          View all
        </Link>
      </div>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="alyssa-table min-w-[780px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              {["Captured", "Customer", "Phone", "Brand", "Treatment / Package", "Status"].map(
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
                    {lead.customer_name || lead.contact?.customer_name || "Not set"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.phone || lead.normalized_phone || lead.contact?.phone || "Not set"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.brand?.name || "Config-backed"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    {lead.treatment?.name || "Config-backed"}
                    <span className="block font-bold text-slate-950">
                      {lead.package?.name || "Package"} ·{" "}
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
                  No leads found in this reporting window.
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
  if (lead.payment_status === "paid") return "Paid";
  if (bookingStatus === "confirmed") return "Booking confirmed";
  if (lead.payment_status === "booking_only") return "Booking requested";
  if (lead.payment_status === "pending") return "Payment pending";
  if (lead.lead_status === "lost") return "Lost";
  if (lead.lead_status === "submitted") return "Submitted";
  return "New";
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "No activity";

  return new Intl.DateTimeFormat("zh-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}
