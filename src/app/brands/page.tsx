import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import {
  META_URL_PARAMETER_GUIDE,
  getBrandPixelId,
  getBrandSuggestedDomains,
  getFormOperations,
} from "@/lib/data/brandOperations";
import { getConfigurationData, packagePriceLabel } from "@/lib/data/configuration";
import { getLeadRows } from "@/lib/data/businessMetrics";
import { getLandingPageList } from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function BrandWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ brand?: string | string[] }>;
}) {
  const [config, landingPages, leadRows] = await Promise.all([
    getConfigurationData(),
    getLandingPageList(),
    getLeadRows("month", 5000),
  ]);
  const query = await searchParams;
  const requestedBrand = firstParam(query?.brand);
  const selectedBrand =
    config.brands.find(
      (brand) => brand.slug === requestedBrand || brand.id === requestedBrand
    ) ?? config.brands[0];

  const forms = config.forms.filter((form) => form.brandId === selectedBrand?.id);
  const treatments = config.treatments.filter(
    (treatment) => treatment.brandId === selectedBrand?.id
  );
  const treatmentIds = new Set(treatments.map((treatment) => treatment.id));
  const packages = config.packages.filter((item) =>
    treatmentIds.has(item.treatmentId)
  );
  const branches = config.branches.filter(
    (branch) => branch.brandId === selectedBrand?.id
  );
  const pages = landingPages.pages.filter(
    (page) => page.brandId === selectedBrand?.id
  );
  const leads = leadRows.leads.filter(
    (lead) =>
      lead.brand_id === selectedBrand?.id || lead.brand?.id === selectedBrand?.id
  );
  const pixelId = getBrandPixelId(selectedBrand?.slug);
  const suggestedDomains = getBrandSuggestedDomains(selectedBrand?.slug);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Brand Workspace</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                {selectedBrand?.name || "品牌工作區"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                以品牌為中心管理 Forms、Landing Pages、療程、分店、Lead、Pixel
                狀態及 Wix embed 設定。Alyssa、Ineffable Beauty 及 Skin Light
                只作 demo/client brand；產品身份仍然係 LaunchHub。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brands?brand=${brand.slug}`}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    brand.id === selectedBrand?.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50"
                  }`}
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <WorkspaceStat label="Forms" value={forms.length} />
          <WorkspaceStat label="Landing Pages" value={pages.length} />
          <WorkspaceStat label="Leads 本月" value={leads.length} />
          <WorkspaceStat label="療程" value={treatments.length} />
          <WorkspaceStat label="Packages" value={packages.length} />
          <WorkspaceStat label="分店" value={branches.length} />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">Launch shortcuts</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              {selectedBrand?.name} Campaign 啟動入口
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ActionCard
                href={`/forms/new?brand=${selectedBrand?.slug || ""}`}
                title="建立 Wix Form"
                body="由品牌、療程、Package、分店到 allowed domains，一次過準備收 Lead 入口。"
              />
              <ActionCard
                href={`/campaigns/new?brand=${selectedBrand?.slug || ""}`}
                title="建立 Landing Page"
                body="把 offer、療程角度及表格包裝成 Campaign 測試頁。"
              />
              <ActionCard
                href={`/forms?brand=${selectedBrand?.slug || ""}`}
                title="管理 Forms"
                body="查看 token、embed snippet、test URL、Pixel 狀態及來源捕捉設定。"
              />
              <ActionCard
                href="/system-audit"
                title="System Audit"
                body="檢查部署、Public Capture Health、安全設定及 optional integrations。"
              />
            </div>
          </section>

          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">Tracking setup</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Pixel / Domain 狀態
            </h2>
            <div className="mt-4 grid gap-3">
              <SetupRow
                label="Meta Pixel"
                value={
                  pixelId
                    ? `已設定 Pixel ID：${pixelId}`
                    : "未設定 Pixel；Form 仍可建立，但 embed snippet 不會加入 data-pixel-id。"
                }
                good={Boolean(pixelId)}
              />
              <SetupRow
                label="Allowed domains 建議"
                value={suggestedDomains.join(", ")}
                good={suggestedDomains.length > 0}
              />
              <SetupRow
                label="Meta URL Parameters"
                value="投放 Meta Ads 時使用 UTM / ad id 參數；debug 參數只可用於測試，不要放入正式廣告。"
                good
              />
            </div>
          </section>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="alyssa-premium-card min-w-0 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="alyssa-kicker">Forms</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  品牌表格
                </h2>
              </div>
              <Link
                href={`/forms?brand=${selectedBrand?.slug || ""}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {forms.slice(0, 5).map((form) => {
                const ops = getFormOperations(config, form);
                return (
                  <div
                    key={form.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-950">{form.formName}</h3>
                        <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-500">
                          {form.publicFormToken}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {ops.treatment?.name || "未設定療程"} · {ops.packageLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <CopyButton value={ops.embedCode} label="Copy Embed" />
                        <Link
                          href={`/forms/${form.id}`}
                          className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Detail
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              {forms.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  暫時未有此品牌 Forms。可以由「建立 Wix Form」開始。
                </p>
              )}
            </div>
          </section>

          <section className="alyssa-premium-card min-w-0 p-5">
            <p className="alyssa-kicker">Meta URL Parameters</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Meta Ads 來源參數範本
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              將以下參數貼到 Meta Ads URL Parameters。正式廣告不要加入
              pixel_debug 或 attribution_debug。
            </p>
            <div className="mt-4">
              <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy URL Parameters" />
            </div>
            <pre className="mt-4 max-h-48 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-white">
              {META_URL_PARAMETER_GUIDE}
            </pre>
          </section>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <LibraryPanel
            title="療程 / Packages"
            href="/settings#brand-library"
            items={treatments.map((treatment) => {
              const firstPackage = packages.find(
                (item) => item.treatmentId === treatment.id
              );
              return `${treatment.name} · ${
                firstPackage ? packagePriceLabel(firstPackage) : "未設定 package"
              }`;
            })}
          />
          <LibraryPanel
            title="分店"
            href="/settings#brand-library"
            items={branches.map((branch) => `${branch.name} · ${branch.status}`)}
          />
          <LibraryPanel
            title="Landing Pages"
            href="/landing-pages"
            items={pages.slice(0, 5).map((page) => `${page.title} · ${page.status}`)}
          />
        </section>
      </div>
    </main>
  );
}

function WorkspaceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="alyssa-premium-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ActionCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
    >
      <h3 className="font-bold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </Link>
  );
}

function SetupRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4">
      <div>
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="mt-1 break-words text-sm leading-6 text-slate-600">
          {value}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
          good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {good ? "OK" : "Review"}
      </span>
    </div>
  );
}

function LibraryPanel({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: string[];
}) {
  return (
    <section className="alyssa-premium-card min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <Link
          href={href}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          Open
        </Link>
      </div>
      <div className="mt-4 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <p
              key={item}
              className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              {item}
            </p>
          ))
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
            暫時未有資料。
          </p>
        )}
      </div>
    </section>
  );
}
