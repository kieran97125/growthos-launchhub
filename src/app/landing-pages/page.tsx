import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  getLandingPageContext,
  getLandingPageImageStatus,
  type LandingPageConfig,
} from "@/lib/data/landingPages";
import { getLandingPageList } from "@/lib/data/landingPageStore";
import { getPublicLandingPageUrl } from "@/lib/data/appUrl";
import {
  getConfigurationData,
  getPackage,
  packagePriceLabel,
  type FormSetting,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function modeLabel(mode: LandingPageConfig["mode"]) {
  return mode === "landing_page" ? "Landing Page" : "Wix 表格";
}

function statusLabel(status: LandingPageConfig["status"]) {
  if (status === "published") return "已發布";
  if (status === "draft") return "草稿";
  if (status === "archived") return "已封存";
  return status;
}

function findConnectedForm(page: LandingPageConfig, forms: FormSetting[]) {
  return (
    forms.find((form) => form.id === page.formId) ??
    forms.find((form) => form.publicFormToken === page.formToken) ??
    null
  );
}

export default async function LandingPagesPage() {
  const [landingPageResult, config] = await Promise.all([
    getLandingPageList(),
    getConfigurationData(),
  ]);
  const { pages, errorMessage, canPersist } = landingPageResult;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="alyssa-kicker">Landing Pages</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Landing Page 列表
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              管理用於測試優惠、文案和圖片角度的 Campaign Landing Pages。
            </p>
          </div>
          <Link
            href="/campaigns/new"
            className="w-fit rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
          >
            建立 Campaign
          </Link>
        </header>

        {errorMessage ? (
          <section className="mt-6 rounded-[28px] border border-red-200 bg-white/90 p-8 shadow-[0_18px_50px_rgba(127,29,29,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">
              Unable to load
            </p>
            <h2 className="mt-3 text-2xl font-bold text-[#321428]">
              未能讀取 Landing Pages
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6d4a5c]">
              {errorMessage}
            </p>
            <a
              href="/landing-pages"
              className="mt-5 inline-flex rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
            >
              重新載入
            </a>
          </section>
        ) : null}

        {/* A successful zero-row query is a loaded empty list, not a blank screen. */}
        {!errorMessage && pages.length === 0 ? (
          <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/88 p-8 text-center shadow-[0_18px_50px_rgba(90,35,72,0.08)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0ea] text-lg font-black text-[#e46f64]">
              LP
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              {canPersist ? "Growth OS database connected" : "Database unavailable"}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#321428]">
              列表已載入，暫時未有 Landing Page
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#6d4a5c]">
              建立第一個 Campaign 後，Landing Page 草稿、狀態、公開網址及編輯入口會喺呢度顯示。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                href="/campaigns/new"
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
              >
                建立第一個 Campaign
              </Link>
              <Link
                href="/settings#brand-library"
                className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                前往品牌資料庫
              </Link>
            </div>
          </section>
        ) : null}

        {pages.length > 0 ? (
        <section className="mt-6 grid gap-5">
          {pages.map((page, index) => {
            const context = getLandingPageContext(page);
            const selectedPackage =
              getPackage(config, page.packageId) ??
              config.packages.find((item) => item.id === context.package?.id);
            const connectedForm = findConnectedForm(page, config.forms);
            const publicUrl = getPublicLandingPageUrl(page.slug);
            const publicLabel =
              page.status === "published" ? publicUrl : "草稿，發布後才會公開";

            return (
              <MotionReveal key={page.id} delay={0.04 + index * 0.06}>
                <article className="alyssa-premium-card alyssa-interactive-card min-w-0 p-5">
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_0.78fr]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill>{modeLabel(page.mode)}</StatusPill>
                        <StatusPill>{statusLabel(page.status)}</StatusPill>
                        <StatusPill>{getLandingPageImageStatus(page)}</StatusPill>
                      </div>
                      <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                        {page.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {page.heroSubtitle}
                      </p>
                      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <InfoCell label="Slug" value={page.slug} mono />
                        <InfoCell label="品牌" value={context.brand?.name ?? "未設定"} />
                        <InfoCell label="療程" value={context.treatment?.name ?? "未設定"} />
                        <InfoCell label="套餐價錢" value={packagePriceLabel(selectedPackage)} />
                        <InfoCell label="分店" value={context.branch?.name ?? "未設定"} />
                        <InfoCell
                          label="連接表格"
                          value={connectedForm?.formName ?? page.formToken}
                        />
                      </dl>
                    </div>

                    <div className="min-w-0 rounded-[22px] bg-[#fff6f0] p-4">
                      <p className="text-sm font-bold text-[#321428]">連結</p>
                      <dl className="mt-4 grid gap-3">
                        <InfoCell
                          label="表格代號"
                          value={connectedForm?.publicFormToken ?? page.formToken}
                          mono
                        />
                        <InfoCell label="公開網址" value={publicLabel} mono />
                      </dl>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/landing-pages/${page.id}`}
                          className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
                        >
                          編輯 Landing Page
                        </Link>
                        {page.status === "published" && (
                          <a
                            href={publicUrl}
                            className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                          >
                            開啟公開頁
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </MotionReveal>
            );
          })}
        </section>
        ) : null}
      </div>
    </main>
  );
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      {children}
    </span>
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
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </dt>
      <dd
        className={`mt-2 break-words text-sm font-semibold text-[#5a2348] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
