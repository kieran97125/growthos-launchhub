import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import {
  duplicateFormAction,
  rotateFormTokenAction,
  updateFormAction,
} from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getFormOperations,
} from "@/lib/data/brandOperations";
import {
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";
import { getOneTimeFormToken } from "@/lib/security/tokenReveal";

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

  const oneTimeToken = await getOneTimeFormToken(form.id);
  const runtimeForm = oneTimeToken
    ? { ...form, publicFormToken: oneTimeToken, publicTokenAvailable: true }
    : form;
  const ops = getFormOperations(config, runtimeForm);
  const brandServices = config.treatments.filter(
    (item) => item.brandId === form.brandId && item.status === "active"
  );
  const serviceIds = new Set(brandServices.map((item) => item.id));
  const brandPackages = config.packages.filter(
    (item) => serviceIds.has(item.treatmentId) && item.status === "active"
  );
  const brandLocations = config.branches.filter(
    (item) => item.brandId === form.brandId && item.status === "active"
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Form Detail</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">{form.formName}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                此 Form 屬於 {ops.brand?.name || "未設定品牌"}。管理 Service、Package、Location、allowed domains、conversion mode 同安全 Token 輪替。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/forms"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
              >
                返回 Forms
              </Link>
              {ops.tokenAvailable ? (
                <Link
                  href={`/embed/${runtimeForm.publicFormToken}`}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white"
                >
                  Open Test Form
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {message ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        ) : null}

        {oneTimeToken ? (
          <section className="mt-5 rounded-[28px] border border-emerald-300 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              One-time token reveal
            </p>
            <h2 className="mt-2 text-xl font-bold text-emerald-950">
              原始 Token 只會顯示約 10 分鐘
            </h2>
            <p className="mt-2 break-all font-mono text-sm font-bold text-emerald-900">
              {oneTimeToken}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={oneTimeToken} label="Copy Token" />
              <CopyButton value={ops.embedCode} label="Copy Wix Embed" />
              <CopyButton value={ops.previewUrl} label="Copy Test URL" />
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
            <p className="text-sm font-bold text-sky-900">Token 受保護</p>
            <p className="mt-1 text-sm leading-6 text-sky-800">
              Database 只儲存 SHA-256 hash，無法還原原始 Token。需要新 Embed 時請執行 Token Rotation；舊 Token會即時失效。
            </p>
          </section>
        )}

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <StatusCard label="Brand" value={ops.brand?.name || "未設定"} />
          <StatusCard label="Service" value={ops.treatment?.name || "未設定"} />
          <StatusCard label="Package" value={ops.packageLabel} />
          <StatusCard label="Location" value={ops.branchLabel} />
          <StatusCard
            label="Mode"
            value={form.isTestForm ? "Test Form" : "Production Form"}
            warning={form.isTestForm !== false}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
          <form action={updateFormAction} className="alyssa-premium-card grid min-w-0 gap-5 p-5">
            <input type="hidden" name="formId" value={form.id} />
            <input type="hidden" name="brandId" value={form.brandId} />
            <input type="hidden" name="isTestForm" value={form.isTestForm === false ? "false" : "true"} />

            <div>
              <p className="alyssa-kicker">Tenant-safe settings</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Form 設定</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Form name" name="formName" value={form.formName} />
              <ReadonlyField label="Brand" value={ops.brand?.name || "未設定"} />
              <SelectField
                label="Service"
                name="defaultTreatmentId"
                value={form.defaultTreatmentId || ""}
                options={brandServices.map((item) => ({ value: item.id, label: item.name }))}
              />
              <SelectField
                label="Package"
                name="defaultPackageId"
                value={form.defaultPackageId || ""}
                options={brandPackages.map((item) => ({
                  value: item.id,
                  label: `${packagePriceLabel(item)} · ${getTreatment(config, item.treatmentId)?.name || "Service"}`,
                }))}
              />
              <SelectField
                label="Location"
                name="defaultBranchId"
                value={form.defaultBranchId || ""}
                options={brandLocations.map((item) => ({ value: item.id, label: item.name }))}
              />
              <SelectField
                label="Status"
                name="status"
                value={form.status === "inactive" ? "inactive" : "active"}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
              <SelectField
                label="Conversion mode"
                name="conversionMode"
                value={form.conversionMode === "thank_you_redirect" ? "thank_you_redirect" : "form_submit_pixel"}
                options={[
                  { value: "form_submit_pixel", label: "Form submit pixel" },
                  { value: "thank_you_redirect", label: "Thank-you redirect" },
                ]}
              />
              <TextField
                label="Thank-you base URL"
                name="successRedirectBaseUrl"
                value={form.successRedirectUrl || ""}
                required={false}
              />
            </div>

            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Allowed domains</span>
              <textarea
                name="allowedDomains"
                rows={4}
                required
                defaultValue={form.allowedDomains.join("\n")}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
              />
            </label>

            <div className="rounded-2xl bg-slate-50 p-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoCell label="Token hash" value={form.publicFormTokenHash || "Missing"} mono />
                <InfoCell label="Updated" value={formatDate(form.updatedAt)} />
                <InfoCell label="Conversion mode" value={form.conversionMode || "form_submit_pixel"} />
                <InfoCell label="Derived redirect" value={ops.derivedConfig.successRedirectUrl || "Not configured"} mono />
              </dl>
            </div>

            <button className="w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
              Save Form
            </button>
          </form>

          <aside className="grid h-fit min-w-0 gap-5">
            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">Token rotation</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">生成新 Public Token</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                輪替後舊 Token 即時失效。新 Token 只會喺呢部瀏覽器顯示 10 分鐘。
              </p>
              <form action={rotateFormTokenAction} className="mt-4">
                <input type="hidden" name="formId" value={form.id} />
                <button className="w-full rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-white">
                  Rotate Token
                </button>
              </form>
            </section>

            {ops.tokenAvailable ? (
              <EmbedCodeCard
                code={ops.embedCode}
                title="Ready-to-copy Wix embed"
                description="包含 one-time Public Token、lazy loading、tracking capture 同目前 Package event value。"
              />
            ) : null}

            <EmbedCodeCard
              code={ops.wixAttributionBridgeCode}
              title="Wix UTM Bridge"
              description="將呢段加入承載 Form 嘅 Wix Page Code，確保網址 UTM、Campaign、Ad 同 Placement 可以穿過 HTML Component 傳入 LaunchHub。預設 HTML Component ID 係 #html1。"
            />

            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">Meta URL Parameters</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">來源參數範本</h2>
              <div className="mt-4">
                <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy URL Parameters" />
              </div>
            </section>

            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">Duplicate</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">複製 Form</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                複製設定並生成獨立 Token，唔會共用原 Form credential。
              </p>
              <form action={duplicateFormAction} className="mt-4">
                <input type="hidden" name="formId" value={form.id} />
                <button className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700">
                  Duplicate Form
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
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</p>
      <p className={`mt-3 break-words text-lg font-bold ${warning ? "text-amber-700" : "text-slate-950"}`}>
        {value}
      </p>
    </section>
  );
}

function TextField({
  label,
  name,
  value,
  required = true,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</span>
      <input
        name={name}
        required={required}
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
      />
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-700">{value}</p>
    </div>
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
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</span>
      <select
        name={name}
        required
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
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
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</dt>
      <dd className={`mt-2 break-words text-sm font-semibold text-slate-700 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
