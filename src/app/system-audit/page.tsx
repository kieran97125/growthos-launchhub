import { AppNav } from "@/components/alyssa/AppNav";
import {
  getAdminBaseUrl,
  getPublicBaseUrl,
  getPublicLandingPageUrl,
} from "@/lib/data/appUrl";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { countBy, formatDateTime } from "@/lib/data/businessMetrics";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";
import { getPublishedLandingPageBySlug } from "@/lib/data/landingPageStore";
import { getGoogleSheetsLeadSyncStatus } from "@/lib/integrations/googleSheetsLeadSync";
import {
  getAdminPasswordGateWarning,
  hasAdminPasswordGateConfig,
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const crmFeedback = [
  "booking_confirmed",
  "booking_rescheduled",
  "booking_cancelled",
  "crm_followup_started",
  "crm_followup_updated",
  "show_up",
  "no_show",
  "deal_paid",
  "deal_lost",
];

type CheckTone = "configured" | "missing" | "review" | "optional";

type ReadinessCheck = {
  label: string;
  detail: string;
  tone: CheckTone;
};

type ReadinessSection = {
  title: string;
  description: string;
  checks: ReadinessCheck[];
};

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function statusLabel(tone: CheckTone) {
  if (tone === "configured") return "已設定";
  if (tone === "missing") return "未設定";
  if (tone === "optional") return "可選";
  return "需要檢查";
}

function toneClassName(tone: CheckTone) {
  if (tone === "configured") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "missing") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (tone === "optional") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

async function getAuditSummary() {
  if (!hasSupabaseAdminEnv()) {
    return {
      status: "Supabase admin env 未完整設定；只能顯示環境 readiness。",
      latestLeadAt: null,
      sourceSnapshots: 0,
      leadEvents: 0,
      trackingStatus: [],
      error: null,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [snapshots, events, tracking, latestLead] = await Promise.all([
      supabase
        .from("lead_source_snapshots")
        .select("*", { count: "exact", head: true }),
      supabase.from("lead_events").select("*", { count: "exact", head: true }),
      supabase.from("lead_source_snapshots").select("tracking_status").limit(5000),
      supabase
        .from("leads")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (snapshots.error) throw snapshots.error;
    if (events.error) throw events.error;
    if (tracking.error) throw tracking.error;
    if (latestLead.error) throw latestLead.error;

    return {
      status: "Supabase admin diagnostic query 正常。只顯示統計結果，不顯示 raw source evidence。",
      latestLeadAt: latestLead.data?.[0]?.created_at ?? null,
      sourceSnapshots: snapshots.count ?? 0,
      leadEvents: events.count ?? 0,
      trackingStatus: countBy(tracking.data ?? [], "tracking_status"),
      error: null,
    };
  } catch (error) {
    return {
      status: "Supabase diagnostic query 需要檢查。",
      latestLeadAt: null,
      sourceSnapshots: 0,
      leadEvents: 0,
      trackingStatus: [],
      error: error instanceof Error ? error.message : "unknown_query_error",
    };
  }
}

async function getReadinessSections(): Promise<ReadinessSection[]> {
  const demoForm = await getFormByIdOrSlug(alyssaDefaultForm.publicFormToken);
  const publicLp = await getPublishedLandingPageBySlug("alyssa-main-trial-offer");
  const sheetsStatus = getGoogleSheetsLeadSyncStatus();
  const adminGateWarning = getAdminPasswordGateWarning();
  const adminGateConfigured = hasAdminPasswordGateConfig();

  const googleSheetsTone: CheckTone =
    sheetsStatus.status === "enabled"
      ? "configured"
      : sheetsStatus.status === "missing_config"
        ? "review"
        : "optional";

  return [
    {
      title: "Environment",
      description:
        "確認 LaunchHub runtime 所需環境是否存在。此區只顯示狀態，不顯示任何 secret value。",
      checks: [
        {
          label: "Supabase URL",
          detail: "NEXT_PUBLIC_SUPABASE_URL",
          tone: envPresent("NEXT_PUBLIC_SUPABASE_URL") ? "configured" : "missing",
        },
        {
          label: "Supabase anon key",
          detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY is public anon config; value hidden here.",
          tone: envPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "configured" : "missing",
        },
        {
          label: "App URL",
          detail: envPresent("NEXT_PUBLIC_APP_URL")
            ? "NEXT_PUBLIC_APP_URL configured"
            : "Using fallback/public base URL. Set NEXT_PUBLIC_APP_URL before final production handoff.",
          tone: envPresent("NEXT_PUBLIC_APP_URL") ? "configured" : "review",
        },
        {
          label: "Public base URL",
          detail: getPublicBaseUrl(),
          tone: "configured",
        },
        {
          label: "Admin base URL",
          detail: getAdminBaseUrl(),
          tone: "configured",
        },
      ],
    },
    {
      title: "Public Capture Health",
      description:
        "檢查 public form、Landing Page route 及來源證據統計。此頁不直接顯示 raw tracking payload。",
      checks: [
        {
          label: "Public form lookup",
          detail: demoForm.form ? "Default demo form resolves." : "Default demo form lookup failed.",
          tone: demoForm.form ? "configured" : "missing",
        },
        {
          label: "Landing Page route",
          detail: publicLp
            ? getPublicLandingPageUrl("alyssa-main-trial-offer")
            : "Demo landing page route not found.",
          tone: publicLp ? "configured" : "missing",
        },
        {
          label: "Source Snapshot evidence",
          detail: "Counts are shown below. Raw snapshot evidence remains internal and is not browser-readable as a normal setting.",
          tone: hasSupabaseAdminEnv() ? "configured" : "review",
        },
      ],
    },
    {
      title: "Security",
      description:
        "Internal-only access checks. Keep admin password gate for now; Growth OS SSO / tenant permission is intentionally not part of this task.",
      checks: [
        {
          label: "Supabase service role key",
          detail: "Server-side only. Configured status only; value is never displayed.",
          tone: envPresent("SUPABASE_SERVICE_ROLE_KEY") ? "configured" : "missing",
        },
        {
          label: "Admin password gate",
          detail: adminGateConfigured
            ? "LaunchHub admin password gate is configured."
            : adminGateWarning ?? "Admin password gate is not configured in this environment.",
          tone: adminGateConfigured
            ? "configured"
            : isAdminPasswordGateEnabled()
              ? "missing"
              : "review",
        },
        {
          label: "Secret exposure",
          detail: "Secrets, service role key, webhook secret and raw source evidence are not displayed on this page.",
          tone: "configured",
        },
      ],
    },
    {
      title: "Optional Integrations",
      description:
        "Google Sheets lead sync is optional. LaunchHub core readiness does not require it.",
      checks: [
        {
          label: "Google Sheets lead sync",
          detail:
            sheetsStatus.status === "enabled"
              ? "Optional sync configured."
              : sheetsStatus.status === "missing_config"
                ? "Optional sync is enabled but needs configuration."
                : "Optional sync is disabled. LaunchHub core capture can still run.",
          tone: googleSheetsTone,
        },
      ],
    },
    {
      title: "Demo / Seed Config",
      description:
        "Seed records are for demo and campaign testing. Business users should manage live brand data in Brand Library, Forms and Landing Pages.",
      checks: [
        {
          label: "Default demo form token",
          detail: demoForm.form
            ? "Demo form token exists and resolves."
            : "Demo form token does not resolve.",
          tone: demoForm.form ? "configured" : "missing",
        },
        {
          label: "Demo brand records",
          detail: "Alyssa, Ineffable and Skin Light remain brand examples/themes, not LaunchHub product identity.",
          tone: "optional",
        },
        {
          label: "CRM outcome event contract",
          detail: "Event names are listed below for future CRM outcome write-back.",
          tone: "optional",
        },
      ],
    },
  ];
}

export default async function SystemAuditPage() {
  const [summary, readinessSections] = await Promise.all([
    getAuditSummary(),
    getReadinessSections(),
  ]);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Internal Setup / Deployment Readiness
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            System Audit
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            這是 LaunchHub 內部診斷頁，用於檢查 runtime、public capture、security
            及 optional integration 狀態。它不是一般 business-facing settings；
            正常業務設定應留在品牌、療程、Package、分店、Forms、Landing Pages
            及 Allowed Domains。
          </p>
          <p className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            {summary.status}
          </p>
          {summary.error && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Diagnostic query needs review. Error details are only shown to internal admins: {summary.error}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-5">
          {readinessSections.map((section) => (
            <ReadinessSectionCard key={section.title} section={section} />
          ))}
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <AuditCard label="Source Snapshot count" value={summary.sourceSnapshots} />
          <AuditCard label="Lead event count" value={summary.leadEvents} />
          <AuditCard
            label="Latest Lead"
            value={formatDateTime(summary.latestLeadAt)}
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">
            Tracking Status Evidence
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Aggregated diagnostic view only. Raw tracking/source snapshot evidence is not shown here.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.trackingStatus.length > 0 ? (
              summary.trackingStatus.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-mono text-xs font-bold text-slate-600">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {item.count}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                No tracking_status aggregate data in this environment yet.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">
            Demo / Future CRM Outcome Event Names
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            These are internal event contract names for future CRM write-back. They are not normal LaunchHub business settings.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {crmFeedback.map((eventName) => (
              <div
                key={eventName}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700"
              >
                {eventName}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReadinessSectionCard({ section }: { section: ReadinessSection }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
            Internal diagnostic
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            {section.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          {section.description}
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {section.checks.map((item) => (
          <ReadinessCard key={`${section.title}-${item.label}`} {...item} />
        ))}
      </div>
    </section>
  );
}

function ReadinessCard({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: CheckTone;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClassName(tone)}`}>
          {statusLabel(tone)}
        </span>
      </div>
      <p className="mt-2 break-words text-xs font-semibold leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function AuditCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
