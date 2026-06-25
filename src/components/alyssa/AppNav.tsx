import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard / 總覽" },
  { href: "/brands", label: "品牌工作區" },
  { href: "/campaigns/new", label: "建立 Campaign" },
  { href: "/landing-pages", label: "Landing Pages" },
  { href: "/forms", label: "Forms / 表格" },
  { href: "/leads", label: "Leads / 登記記錄" },
  { href: "/performance", label: "成效" },
  { href: "/settings#brand-library", label: "品牌資料庫" },
  { href: "/settings", label: "設定" },
];

export async function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/88 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/76">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)]">
            LH
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
              LaunchHub
            </span>
            <span className="block text-xl font-bold text-slate-950">
              Campaign Launch & Lead Capture OS
            </span>
          </span>
        </Link>
        <nav className="flex min-w-0 flex-wrap gap-2 md:justify-end">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`alyssa-focus rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
                item.href === "/campaigns/new"
                  ? "border-slate-950 bg-slate-950 text-white hover:border-slate-800 hover:bg-slate-800"
                  : "border-slate-200 bg-white/78 text-slate-700 hover:border-sky-200 hover:bg-sky-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
