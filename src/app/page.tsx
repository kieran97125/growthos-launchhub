import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";

const homeCards = [
  {
    href: "/campaigns/new",
    eyebrow: "Campaign builder",
    title: "Create a launch flow",
    body: "Prepare a campaign form, landing page mode and source capture setup from one guided workspace.",
  },
  {
    href: "/forms",
    eyebrow: "Lead capture",
    title: "Manage forms and embeds",
    body: "Create reusable registration forms, public tokens and Wix embed snippets for each brand.",
  },
  {
    href: "/landing-pages",
    eyebrow: "Campaign pages",
    title: "Launch testing pages",
    body: "Package an offer, treatment angle and form into a campaign page without replacing the main website.",
  },
  {
    href: "/settings#brand-library",
    eyebrow: "Configuration",
    title: "Set brand scope",
    body: "Keep brands, treatments, packages, branches and form defaults ready for campaign launches.",
  },
];

export default function HomePage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_48%,#eaf6ff_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="alyssa-kicker">LaunchHub</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
                Campaign Launch & Lead Capture OS
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                Create campaign forms, Wix embeds, landing pages, UTM capture
                and source snapshots for every brand. LaunchHub is the entry
                point for collecting leads and preserving original marketing
                evidence before CRM follow-up.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
                建立 campaign form、Wix embed、landing page、UTM 捕捉及 lead
                source snapshot，作為品牌收 lead 同記錄來源證據嘅入口。
              </p>
            </div>

            <div className="rounded-3xl border border-sky-100 bg-white/88 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                Product boundary
              </p>
              <h2 className="mt-3 text-xl font-bold text-slate-950">
                Launch now, analyze later
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                LaunchHub owns capture, embeds, tokens and source snapshots.
                GrowthRadar owns downstream intelligence, source quality and
                monthly reporting.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/campaigns/new"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Create campaign flow
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-sky-50"
            >
              Open dashboard
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {homeCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
            >
              <p className="alyssa-kicker">{card.eyebrow}</p>
              <h2 className="mt-3 text-xl font-bold text-slate-950">
                {card.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {card.body}
              </p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
