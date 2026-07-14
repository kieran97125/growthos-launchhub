import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { createFormAction } from "@/app/forms/actions";
import {
  getConfigurationData,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function NewFormPage({
  searchParams,
}: {
  searchParams?: Promise<{ brand?: string | string[]; form_status?: string | string[] }>;
}) {
  const query = await searchParams;
  const config = await getConfigurationData();
  const selectedBrandParam = first(query?.brand);
  const message = first(query?.form_status);
  const selectedBrand =
    config.brands.find(
      (brand) => brand.id === selectedBrandParam || brand.slug === selectedBrandParam
    ) ?? config.brands[0];
  const services = config.treatments.filter(
    (item) => item.brandId === selectedBrand?.id && item.status === "active"
  );
  const serviceIds = new Set(services.map((item) => item.id));
  const packages = config.packages.filter(
    (item) => serviceIds.has(item.treatmentId) && item.status === "active"
  );
  const locations = config.branches.filter(
    (item) => item.brandId === selectedBrand?.id && item.status === "active"
  );
  const firstService = services[0];
  const firstPackage =
    packages.find((item) => item.treatmentId === firstService?.id) ?? packages[0];
  const ready = Boolean(selectedBrand && firstService && firstPackage && locations[0]);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Create Form</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                建立 Growth OS 原生 Form
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                系統會建立 tenant-scoped Form config、生成高強度 Public Token，並只將 SHA-256 hash 儲存在資料庫。原始 Token 只會在建立後顯示 10 分鐘。
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

        {message ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        ) : null}

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
                    : "border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
                }`}
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>

        {!ready ? (
          <section className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold text-amber-950">品牌設定未完整</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
              建立 Form 前，品牌必須至少有一個 Active Service、Package 同 Location。
            </p>
          </section>
        ) : (
          <form action={createFormAction} className="mt-6 grid gap-5">
            <input type="hidden" name="brandId" value={selectedBrand.id} />
            <input type="hidden" name="status" value="active" />

            <section className="alyssa-premium-card grid gap-5 p-5">
              <div>
                <p className="alyssa-kicker">Step 2</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Form identity</h2>
              </div>
              <TextField
                label="Form name"
                name="formName"
                defaultValue={`${selectedBrand.name} ${firstService.name} Campaign Form`}
              />
            </section>

            <section className="alyssa-premium-card grid gap-5 p-5">
              <div>
                <p className="alyssa-kicker">Step 3</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Offer scope</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Package 必須屬於所選 Service；系統會在 server 同 database 兩層重新驗證。
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <SelectField
                  label="Service"
                  name="defaultTreatmentId"
                  defaultValue={firstService.id}
                  options={services.map((item) => ({ value: item.id, label: item.name }))}
                />
                <SelectField
                  label="Package"
                  name="defaultPackageId"
                  defaultValue={firstPackage.id}
                  options={packages.map((item) => ({
                    value: item.id,
                    label: `${packagePriceLabel(item)} · ${getTreatment(config, item.treatmentId)?.name || "Service"}`,
                  }))}
                />
                <SelectField
                  label="Location"
                  name="defaultBranchId"
                  defaultValue={locations[0].id}
                  options={locations.map((item) => ({ value: item.id, label: item.name }))}
                />
              </div>
            </section>

            <section className="alyssa-premium-card grid gap-5 p-5">
              <div>
                <p className="alyssa-kicker">Step 4</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Security & conversion</h2>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Allowed domains</span>
                <textarea
                  name="allowedDomains"
                  rows={4}
                  required
                  placeholder="https://www.example.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
                />
                <span className="mt-2 block text-xs font-semibold text-slate-500">
                  每行一個網站 origin。Public submission 只接受呢啲來源。
                </span>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Conversion mode"
                  name="conversionMode"
                  defaultValue="form_submit_pixel"
                  options={[
                    { value: "form_submit_pixel", label: "Form submit pixel" },
                    { value: "thank_you_redirect", label: "Thank-you redirect" },
                  ]}
                />
                <TextField
                  label="Thank-you base URL（redirect mode 才需要）"
                  name="successRedirectBaseUrl"
                  defaultValue=""
                  required={false}
                />
              </div>
              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                <input name="isTestForm" type="checkbox" defaultChecked className="mt-1 h-4 w-4" />
                <span>
                  <span className="block text-sm font-bold text-slate-800">標記為 Test Form</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    測試 Lead 會保存 `is_test_data=true`，避免混入正式報表。
                  </span>
                </span>
              </label>
            </section>

            <section className="alyssa-premium-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="alyssa-kicker">Step 5</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">建立及顯示 Token</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  建立後請立即複製 Token 或 Wix Embed；頁面只會暫時顯示原始 Token。
                </p>
              </div>
              <button className="rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(15,23,42,0.2)]">
                建立 Form
              </button>
            </section>
          </form>
        )}
      </div>
    </main>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        required
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
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
