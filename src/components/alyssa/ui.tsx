import Link from "next/link";
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="alyssa-page-shell">{children}</div>;
}

export function PremiumCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`alyssa-premium-card min-w-0 p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow && <p className="alyssa-kicker">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold text-slate-950">{title}</h2>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="alyssa-premium-card min-w-0 p-4">
      <p className="alyssa-kicker">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      {helper && <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>}
    </div>
  );
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50 p-6 text-center">
      <h3 className="font-bold text-slate-950">{title}</h3>
      {body && <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>}
    </div>
  );
}

export function CTAButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] hover:-translate-y-1 hover:bg-slate-800 hover:shadow-[0_18px_42px_rgba(15,23,42,0.26)] active:scale-[0.98]"
      : "border border-slate-200 bg-white/78 text-slate-700 hover:-translate-y-1 hover:bg-sky-50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)] active:scale-[0.98]";

  return (
    <Link
      href={href}
      className={`alyssa-focus inline-flex rounded-full px-5 py-3 text-sm font-bold transition duration-300 ${classes}`}
    >
      {children}
    </Link>
  );
}

export function SoftDivider() {
  return <div className="h-px w-full bg-slate-200" />;
}
