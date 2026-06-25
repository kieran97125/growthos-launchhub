import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
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
    form.publicFormToken.toLowerCase().includes(needle) ||
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
    const ops = getFormOperations(config, form);
    if (brand && form.brandId !== brand.id) return false;
    if (selectedTreatment && form.defaultTreatmentId !== selectedTreatment) {
      return false;
    }
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
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Forms / 表格管理
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                按品牌、療程、分店及狀態管理 Campaign Forms。每個 Form 都有 Public Token、Wix embed snippet、test URL 及來源捕捉設定。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/forms/new${brand ? `?brand=${brand.slug}` : ""}`}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
              >
                建立 Wix Form
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

        {message && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white/88 p-5">
          <form
            className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto]"
            method="get"
          >
            <FilterSelect
              label="Brand"
              name="brand"
              value={brand?.slug || ""}
              options={config.brands.map((item) => ({
                value: item.slug,
                label: item.name,
              }))}
            />
            <FilterSelect
              label="Treatment"
              name="treatment"
              value={selectedTreatment}
              options={config.treatments
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Branch"
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
              options={Array.from(new Set(config.forms.map((form) => form.status))).map(
                (status) => ({ value: status, label: status || "未設定" })
              )}
            />
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                Search
              </span>
              <input
                name="q"
                defaultValue={search}
                placeholder="Form name / token / ID"
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
            <table className="min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {[
                    "Form name",
                    "Brand",
                    "Treatment / package",
                    "Branch",
                    "Form token",
                    "Status",
                    "Updated",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((form) => {
                  const ops = getFormOperations(config, form);
                  return (
                    <tr
                      key={form.id}
                      className="align-top transition hover:bg-slate-50"
                    >
                      <td className="border-t border-slate-100 px-4 py-4">
                        <Link
                          href={`/forms/${form.id}`}
                          className="font-bold text-slate-950 underline-offset-4 hover:underline"
                        >
                          {form.formName}
                        </Link>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          屬於 {ops.brand?.name || "未設定品牌"}
                        </p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 font-semibold text-slate-700">
                        {ops.brand?.name || "未設定"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <p className="font-semibold text-slate-700">
                          {ops.treatment?.name || "未設定療程"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-950">
                          {ops.packageLabel}
                        </p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 font-semibold text-slate-700">
                        {ops.branchLabel}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <p className="max-w-[250px] break-all font-mono text-xs font-bold text-slate-700">
                          {form.publicFormToken}
                        </p>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {form.status || "active"}
                        </span>
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4 text-xs font-semibold text-slate-500">
                        {form.updatedAt || form.createdAt || "-"}
                      </td>
                      <td className="border-t border-slate-100 px-4 py-4">
                        <div className="flex min-w-[280px] flex-wrap gap-2">
                          <CopyButton value={ops.embedCode} label="Copy Wix Embed" />
                          <Link
                            href={`/embed/${form.publicFormToken}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                          >
                            Test Form
                          </Link>
                          <Link
                            href={`/forms/${form.id}`}
                            className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Detail
                          </Link>
                          <Link
                            href={`/leads?form=${form.publicFormToken}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                          >
                            Leads
                          </Link>
                          <form action={duplicateFormAction}>
                            <input type="hidden" name="formId" value={form.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                            >
                              Duplicate
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredForms.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      未找到符合條件嘅 Form。可以調整篩選或建立新 Wix Form。
                    </td>
                  </tr>
                )}
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
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:bg-white"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
