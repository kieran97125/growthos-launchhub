import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { createFormAction } from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getBrandPixelId,
  getBrandSuggestedDomains,
} from "@/lib/data/brandOperations";
import {
  getConfigurationData,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function suggestedFormName(brandName: string, treatmentName?: string) {
  return [brandName, treatmentName, "Campaign Form"].filter(Boolean).join(" ");
}

export default async function NewFormPage({
  searchParams,
}: {
  searchParams?: Promise<{ brand?: string | string[]; form_status?: string | string[] }>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const selectedBrandParam = firstParam(query?.brand);
  const message = firstParam(query?.form_status);
  const selectedBrand =
    config.brands.find(
      (brand) => brand.slug === selectedBrandParam || brand.id === selectedBrandParam
    ) ?? config.brands[0];
  const brandTreatments = config.treatments.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const selectedTreatment = brandTreatments[0];
  const treatmentIds = new Set(brandTreatments.map((item) => item.id));
  const brandPackages = config.packages.filter((item) =>
    treatmentIds.has(item.treatmentId)
  );
  const firstPackage =
    brandPackages.find((item) => item.treatmentId === selectedTreatment?.id) ??
    brandPackages[0];
  const brandBranches = config.branches.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const firstBranch = brandBranches[0];
  const pixelId = getBrandPixelId(selectedBrand?.slug);
  const suggestedDomains = getBrandSuggestedDomains(selectedBrand?.slug);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Create Wix Form</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                建立品牌 Campaign Form
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                先選品牌，再設定療程、Package、分店、allowed domains 及 tracking 狀態。建立後會得到 Wix embed snippet、test URL 及 Meta URL Parameters。
              </p>
            </div>
            <Link
              href="/forms"
              className="w-fit rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              返回 Forms
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white/88 p-5">
          <p className="alyssa-kicker">Step 1</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">選擇品牌</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {config.brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/forms/new?brand=${brand.slug}`}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${
                  brand.id === selectedBrand?.id
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50"
                }`}
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>

        <form action={createFormAction} className="mt-6 grid gap-5">
          <input type="hidden" name="brandId" value={selectedBrand?.id || ""} />

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 2</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Treatment / Offer
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                只顯示 {selectedBrand?.name || "此品牌"} 可用嘅療程及 Package，避免 Form token 用錯品牌內容。
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Form name"
                name="formName"
                defaultValue={suggestedFormName(
                  selectedBrand?.name || "Brand",
                  selectedTreatment?.name
                )}
              />
              <SelectField
                label="Treatment"
                name="defaultTreatmentId"
                defaultValue={selectedTreatment?.id}
                options={brandTreatments.map((treatment) => ({
                  value: treatment.id,
                  label: treatment.name,
                }))}
              />
              <SelectField
                label="Package / price"
                name="defaultPackageId"
                defaultValue={firstPackage?.id}
                options={brandPackages.map((item) => ({
                  value: item.id,
                  label: packagePriceLabel(item),
                }))}
              />
              <ReadonlyInfo label="Payment mode" value="由 package 設定決定；前端提交不可信價格。" />
            </div>
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 3</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Branch / Form scope
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                V1 每個 Form 使用一個預設分店。多分店選擇可在後續 DB-backed 版本擴充。
              </p>
            </div>
            <SelectField
              label="Default branch"
              name="defaultBranchId"
              defaultValue={firstBranch?.id}
              options={brandBranches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
            />
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 4</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Allowed domains
              </h2>
            </div>
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                Allowed domains
              </span>
              <textarea
                name="allowedDomains"
                rows={4}
                defaultValue={suggestedDomains.join("\n")}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
              />
              <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                請填入可載入此 Form 嘅網站 origin，例如 Wix domain 或 campaign domain。系統會用作 public form 安全檢查。
              </span>
            </label>
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 5</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Tracking / Pixel
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ReadonlyInfo
                label="Brand Pixel"
                value={
                  pixelId
                    ? `Configured: ${pixelId}`
                    : "Missing - Form 仍可建立，但 embed snippet 會略過 data-pixel-id。"
                }
                warning={!pixelId}
              />
              <ReadonlyInfo
                label="Wix embed"
                value={
                  pixelId
                    ? "Embed snippet 會包含 data-pixel-id。"
                    : "Embed snippet 不會包含 data-pixel-id。"
                }
              />
            </div>
            <div>
              <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy Meta URL Parameters" />
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                debug 參數只用於測試；正式 Meta Ads 不要加入 pixel_debug 或 attribution_debug。
              </p>
            </div>
          </section>

          <section className="alyssa-premium-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="alyssa-kicker">Step 6</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Create form
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                建立後前往 Form Detail 複製 Wix embed snippet、test URL 及 Meta URL Parameters。
              </p>
            </div>
            <button
              type="submit"
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-1 hover:bg-slate-800"
            >
              建立 Form
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </span>
      <input
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
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

function ReadonlyInfo({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-bold ${
          warning ? "text-amber-700" : "text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
