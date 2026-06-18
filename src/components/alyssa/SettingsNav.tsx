import Link from "next/link";

const settingsItems = [
  { href: "/settings#brand-library", label: "品牌資料庫" },
  { href: "/settings/brands", label: "品牌" },
  { href: "/settings/treatments", label: "療程" },
  { href: "/settings/packages", label: "Offers / Packages" },
  { href: "/settings/branches", label: "分店" },
  { href: "/settings/templates", label: "Landing Page 範本" },
  { href: "/settings/team", label: "團隊權限" },
];

export function SettingsNav() {
  return (
    <nav className="mt-5 flex min-w-0 flex-wrap gap-2">
      {settingsItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="min-w-0 rounded-full border border-slate-200 bg-white/78 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
