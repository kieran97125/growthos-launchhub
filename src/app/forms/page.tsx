import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { duplicateFormAction } from "@/app/forms/actions";
import { getFormOperations } from "@/lib/data/brandOperations";
import {
  getConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

type FormsSearchParams = {
  brand?: string | string[];
  treatment?: string | string[];
  branch?: string | string[];
  status?: string | string[];
  q?: string | string[];
  form_status?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function formMatchesSearch(form: FormSetting, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    form.formName.toLowerCase().includes(needle) ||
    (form.publicFormTokenHash || "").toLowerCase().includes(needle) ||
    form.id.toLowerCase().includes(needle)
  );
}

export default async function FormsPage({
  searchParams,
}: {
  searchParams?: Promise<FormsSearchParams>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const selectedBrand = firstParam(query?.brand);
  const selectedTreatment = firstParam(query?.treatment);
  const selectedBranch = firstParam(query?.branch);
  const selectedStatus = firstParam(query?.status);
  const search = firstParam(query?.q).trim();
  const message = firstParam(query?.form_status);
  const brand =
    config.brands.find(
      (item) => item.slug === selectedBrand || item.id === selectedBrand
    ) ?? null;
  const filteredForms = config.forms.filter((form) => {
    if (brand && form.brandId !== brand.id) return false;
    if (selectedTreatment && form.defaultTreatmentId !== selectedTreatment) return false;
    if (selectedBranch && form.defaultBranchId !== selectedBranch) return false;
    if (selectedStatus && form.status !== selectedStatus) return false;
    return formMatchesSearch(form, search);
  });

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Forms Operations</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Forms / 表格管理</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Public Token 只以 SHA-256 hash 儲存。建立、複製或輪替後，原始 Token 只會喺 Form Detail 顯示 10 分鐘。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/forms/new"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(15,23,42,0.2)]"
              >
                建立 Form
              </Link>
              <Link
                href="/brands"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
              >
                品牌工作區
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-sm font-bold text-emerald-900">Growth OS Native Admin 已啟用</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            建立、修改、複製及 Token 輪替均使用 tenant-scoped RPC；唔會寫入舊 Alyssa-shaped tables。
          </p>
        </section>

        {message ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white/88 p-5">
          <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto]" method="get">
            <FilterSelect
              label="Brand"
              name="brand"
              value={brand?.slug || ""}
              options={config.brands.map((item) => ({ value: item.slug, label: item.name }))}
            />
            <FilterSelect
              label="Service"
              name="treatment"
              value={selectedTreatment}
              options={config.treatments
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Location"
              name="branch"
              value={selectedBranch}
              options={config.branches
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Status"
              name="status"
              value={selectedStatus}
              options={[
                { value: "active", label: "active" },
                { value: "inactive", label: "inactive" },
              ]}
            />
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Search</span>
              <input
                name="q"
                defaultValue={search}
                placeholder="Form name / hash / ID"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
              />
            </label>
            <button className="self-end rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">
              Filter
            </button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {[
                    "Form name",
                    "Brand",
                    "Service / package",
                    "Location",
                    "Token state",
                    "Status",
                    "Updated",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((form) => {
                  const ops = getFormOperations(config, form);
                  return (
                    <tr key={form.id} className="align-top transition hover:bg-slate-50">
                      <td className="border-t border-slate-100 px-4 py-4">
                        <Link href={`/forms/${form.id}`} className="font-bold text-slate-950 hover:underline">
                          {form.formName}
                        </Link>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {form.isTestForm ? "Test Form" : "Production Form"}
                        </p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 font-semibold text-slate-700">
                        {ops.brand?.name || "未設定"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <p className="font-semibold text-slate-700">{ops.treatment?.name || "未設定服務"}</p>
                        <p className="mt-1 text-xs font-bold text-slate-950">{ops.packageLabel}</p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 font-semibold text-slate-700">
                        {ops.branchLabel}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                          Protected hash
                        </span>
                        <p className="mt-2 max-w-[220px] break-all font-mono text-[10px] text-slate-400">
                          {form.publicFormTokenHash ? `${form.publicFormTokenHash.slice(0, 14)}…` : "No token hash"}
                        </p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${form.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {form.status}
                        </span>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 text-xs font-semibold text-slate-500">
                        {form.updatedAt || form.createdAt || "-"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <div className="flex min-w-[230px] flex-wrap gap-2">
                          <Link
                            href={`/forms/${form.id}`}
                            className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Detail
                          </Link>
                          <form action={duplicateFormAction}>
                            <input type="hidden" name="formId" value={form.id} />
                            <button className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                              Duplicate
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredForms.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      {config.sourceLabel === "Growth OS LaunchHub schema 尚未啟用"
                        ? "LaunchHub data contract 尚未套用；目前安全顯示空資料。"
                        : "未找到符合條件嘅 Form。"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function FilterSelect({
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
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
