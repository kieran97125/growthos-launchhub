import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { duplicateFormAction, updateFormAction } from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getFormOperations,
} from "@/lib/data/brandOperations";
import {
  getBrand,
  getPackage,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "未有記錄";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}

export default async function FormConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams?: Promise<{ form_status?: string | string[] }>;
}) {
  const { formId } = await params;
  const query = await searchParams;
  const message =
    typeof query?.form_status === "string" ? query.form_status : null;
  const { form, config } = await getFormByIdOrSlug(formId);

  if (!form) notFound();

  const ops = getFormOperations(config, form);
  const selectedPackage = getPackage(config, form.defaultPackageId);
  const linkedLandingPages = config.landingPages.filter(
    (page) => page.formId === form.id || page.formToken === form.publicFormToken
  );
  const brandTreatments = config.treatments.filter(
    (item) => item.brandId === form.brandId
  );
  const treatmentIds = new Set(brandTreatments.map((item) => item.id));
  const brandPackages = config.packages.filter((item) =>
    treatmentIds.has(item.treatmentId)
  );
  const brandBranches = config.branches.filter((item) => item.brandId === form.brandId);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Form Detail</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                {form.formName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                此 Form 屬於 {ops.brand?.name || "未設定品牌"}。在這裡管理 token、Wix embed snippet、test URL、Meta URL Parameters、allowed domains 及品牌安全檢查。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/brands?brand=${ops.brand?.slug || ""}`}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
              >
                品牌工作區
              </Link>
              <Link
                href={`/embed/${form.publicFormToken}`}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white"
              >
                Open Test Form
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-4">
          <StatusCard label="Brand" value={ops.brand?.name || "未設定"} />
          <StatusCard label="Treatment" value={ops.treatment?.name || "未設定"} />
          <StatusCard label="Package" value={ops.packageLabel} />
          <StatusCard
            label="Pixel"
            value={ops.pixelConfigured ? ops.pixelId : "Missing"}
            warning={!ops.pixelConfigured}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
          <form action={updateFormAction} className="alyssa-premium-card grid min-w-0 gap-5 p-5">
            <input type="hidden" name="formId" value={form.id} />

            <div>
              <p className="alyssa-kicker">Brand-safe settings</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Form 設定
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Form name" name="formName" value={form.formName} />
              <SelectField
                label="Brand"
                name="brandId"
                value={form.brandId}
                options={config.brands.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Treatment"
                name="defaultTreatmentId"
                value={form.defaultTreatmentId ?? ""}
                options={brandTreatments.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Package / price"
                name="defaultPackageId"
                value={form.defaultPackageId ?? ""}
                options={brandPackages.map((item) => ({
                  value: item.id,
                  label: `${packagePriceLabel(item)} (${getTreatment(config, item.treatmentId)?.name ?? "療程"})`,
                }))}
              />
              <SelectField
                label="Default branch"
                name="defaultBranchId"
                value={form.defaultBranchId ?? ""}
                options={brandBranches.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </div>

            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                Allowed domains
              </span>
              <textarea
                name="allowedDomains"
                rows={4}
                defaultValue={form.allowedDomains.join("\n")}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
              />
              <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                建議：{ops.suggestedDomains.join(", ")}. 只填網站 origin，不要填完整 tracking URL。
              </span>
            </label>

            <div className="rounded-2xl bg-slate-50 p-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoCell label="Form token" value={form.publicFormToken} mono />
                <InfoCell label="Status" value={form.status || "active"} />
                <InfoCell label="Updated" value={formatDate(form.updatedAt)} />
                <InfoCell label="Branch" value={ops.branchLabel} />
                <InfoCell label="Test URL" value={ops.previewUrl} mono />
                <InfoCell
                  label="Landing Pages"
                  value={
                    linkedLandingPages.length > 0
                      ? linkedLandingPages.map((page) => page.title).join(", ")
                      : "未連接 Landing Page"
                  }
                />
              </dl>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-1 hover:bg-slate-800"
              >
                Save Form
              </button>
              <CopyButton value={ops.embedCode} label="Copy Wix Embed" />
              <CopyButton value={form.publicFormToken} label="Copy Token" />
              <CopyButton value={ops.previewUrl} label="Copy Test URL" />
            </div>
          </form>

          <aside className="grid h-fit min-w-0 gap-5">
            <EmbedCodeCard
              code={ops.embedCode}
              title="Ready-to-copy Wix embed"
              description={
                ops.pixelConfigured
                  ? "此 snippet 已包含 data-pixel-id、lazy loading 及 LaunchHub attribution capture。"
                  : "此品牌未設定 Pixel，所以 snippet 不會加入 data-pixel-id；Form 仍可安全收 Lead。"
              }
            />

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Meta URL Parameters</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Meta Ads 來源參數範本
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                貼到 Meta Ads URL Parameters，用作 UTM、campaign/adset/ad id 及 Source Snapshot。正式廣告不要加入 pixel_debug 或 attribution_debug。
              </p>
              <div className="mt-4">
                <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy URL Parameters" />
              </div>
              <pre className="mt-4 max-h-44 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-white">
                {META_URL_PARAMETER_GUIDE}
              </pre>
            </section>

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Brand safety</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                上線前檢查
              </h2>
              <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-slate-600">
                <li>確認 Form token 同 Wix page 屬於同一個品牌。</li>
                <li>確認 allowed domains 包含實際 Wix / campaign domain。</li>
                <li>Pixel missing 不會阻止建立 Form，但不會送出 Pixel beacon。</li>
                <li>不要在正式廣告使用 debug parameters。</li>
              </ul>
            </section>

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Duplicate</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                複製 Form
              </h2>
              <form action={duplicateFormAction} className="mt-4">
                <input type="hidden" name="formId" value={form.id} />
                <button
                  type="submit"
                  className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                >
                  Duplicate
                </button>
              </form>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <section className="alyssa-premium-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </p>
      <p
        className={`mt-3 break-words text-lg font-bold ${
          warning ? "text-amber-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </section>
  );
}

function TextField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </span>
      <input
        name={name}
        required
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </span>
      <select
        name={name}
        required
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/78 p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </dt>
      <dd
        className={`mt-2 break-words text-sm font-semibold text-slate-700 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
