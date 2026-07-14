import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { META_URL_PARAMETER_GUIDE } from "@/lib/data/brandOperations";

export const dynamic = "force-dynamic";

export default function NewFormPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Create Form</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">
                Growth OS 原生 Form 建立流程
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Form 建立功能暫時鎖定。新版會一次過建立 tenant-scoped Form config、生成高強度 Public Token、只儲存 SHA-256 hash，並將原始 token 只顯示一次。
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

        <section className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            Safety gate
          </p>
          <h2 className="mt-2 text-2xl font-bold text-amber-950">
            暫不容許使用舊 Form writer
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-amber-900">
            舊 writer 會寫入 Alyssa-shaped `forms / treatments / packages / branches` 結構。為保持 Growth OS 產品邊界，建立、複製、修改及 Token 輪替會維持停用，直至 Growth OS-native admin workflow 完成驗收。
          </p>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <ReadinessCard
            title="已完成"
            items={[
              "Growth OS Supabase ownership guard",
              "client_id / brand_id tenant scope",
              "hashed public-token lookup",
              "public form read contract",
              "atomic Lead + Source Snapshot write contract",
              "Alyssa / Ineffable token isolation",
            ]}
          />
          <ReadinessCard
            title="啟用前尚欠"
            items={[
              "Reviewed migration in non-production",
              "Synthetic Internal Demo service / package / location",
              "Create Form transaction",
              "One-time raw token reveal",
              "Token rotation and revocation",
              "Cross-tenant E2E isolation test",
            ]}
          />
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white/88 p-6">
          <p className="alyssa-kicker">Prepared tracking contract</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Meta URL Parameters
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tracking contract 可以先保留；正式 Form token 建立後先會生成 embed snippet。
          </p>
          <div className="mt-4">
            <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy URL Parameters" />
          </div>
          <pre className="mt-4 max-h-48 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-white">
            {META_URL_PARAMETER_GUIDE}
          </pre>
        </section>
      </div>
    </main>
  );
}

function ReadinessCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/88 p-6">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <ul className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
