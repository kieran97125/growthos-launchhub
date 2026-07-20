"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import {
  IMAGE_REFERENCE_FOOTER_NOTE,
  LEGAL_CONSENT_HELPER_TEXT,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
  getBrandLegalProfile,
  getLegalFooterText,
  getLegalLinks,
} from "@/lib/legal/consent";
import { useAttributionBridge } from "@/lib/attribution/useAttributionBridge";

type FormOption = { id: string; name: string };
type ServiceOption = FormOption & { description: string };
type PackageOption = FormOption & {
  serviceId: string;
  promoPrice: number;
  originalPrice: number;
  currency: string;
  paymentRequired: boolean;
};
type LocationOption = FormOption;
type BrandOption = FormOption & { slug: string };
type PublicFormConfig = {
  id: string;
  defaultServiceId: string;
  defaultPackageId: string;
  defaultLocationId: string;
  successRedirectUrl: string;
};

type Props = {
  formToken: string;
  formId?: string;
  expectedParentOrigin?: string;
  mode?: "inline" | "embed";
  className?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeForm(raw: Record<string, unknown>): PublicFormConfig | null {
  const id = text(raw.id);
  const defaultServiceId = text(raw.default_treatment_id) || text(raw.default_service_id);
  const defaultPackageId = text(raw.default_package_id);
  const defaultLocationId = text(raw.default_branch_id) || text(raw.default_location_id);
  if (!id || !defaultServiceId || !defaultPackageId || !defaultLocationId) return null;
  return {
    id,
    defaultServiceId,
    defaultPackageId,
    defaultLocationId,
    successRedirectUrl: text(raw.success_redirect_url),
  };
}

function normalizeBrand(raw: Record<string, unknown>): BrandOption | null {
  const id = text(raw.id);
  const name = text(raw.name);
  const slug = text(raw.slug) || text(raw.brand_code).toLowerCase();
  return id && name ? { id, name, slug: slug || "brand" } : null;
}

function normalizeService(raw: Record<string, unknown>): ServiceOption | null {
  const id = text(raw.id);
  const name = text(raw.name);
  return id && name ? { id, name, description: text(raw.description) } : null;
}

function normalizePackage(raw: Record<string, unknown>): PackageOption | null {
  const id = text(raw.id);
  const name = text(raw.name);
  const serviceId = text(raw.service_id) || text(raw.treatment_id);
  if (!id || !name || !serviceId) return null;
  return {
    id,
    name,
    serviceId,
    promoPrice: numberValue(raw.promo_price),
    originalPrice: numberValue(raw.original_price),
    currency: text(raw.currency).toUpperCase() || "HKD",
    paymentRequired: Boolean(raw.payment_required),
  };
}

function normalizeLocation(raw: Record<string, unknown>): LocationOption | null {
  const id = text(raw.id);
  const name = text(raw.name);
  return id && name ? { id, name } : null;
}

function priceLabel(item: PackageOption | undefined) {
  if (!item) return "預約查詢";
  const value = item.promoPrice || item.originalPrice;
  return value > 0 ? `${item.currency === "HKD" ? "HK$" : `${item.currency} `}${value}` : "預約查詢";
}

function safeRedirect(url: unknown) {
  const value = text(url);
  if (!value) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function GrowthOsPublicLeadForm({
  formToken,
  formId,
  expectedParentOrigin,
  mode = "inline",
  className = "",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [publicForm, setPublicForm] = useState<PublicFormConfig | null>(null);
  const [brand, setBrand] = useState<BrandOption | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [formData, setFormData] = useState({
    honeypot: "",
    customer_name: "",
    phone: "",
    email: "",
    treatment_id: "",
    package_id: "",
    branch_id: "",
    appointment_date: "",
    appointment_time: "12:00",
    payment_option: "booking_only",
    legalConsentAccepted: false,
  });

  const selectedService = useMemo(
    () => services.find((item) => item.id === formData.treatment_id) || services[0],
    [formData.treatment_id, services]
  );
  const availablePackages = useMemo(
    () => packages.filter((item) => item.serviceId === selectedService?.id),
    [packages, selectedService?.id]
  );
  const selectedPackage = useMemo(
    () => availablePackages.find((item) => item.id === formData.package_id) || availablePackages[0],
    [availablePackages, formData.package_id]
  );
  const legalProfile = useMemo(
    () =>
      getBrandLegalProfile({
        brandSlug: brand?.slug || "brand",
        brandName: brand?.name || "品牌",
      }),
    [brand?.name, brand?.slug]
  );
  const legalLinks = useMemo(() => getLegalLinks(legalProfile.brandSlug), [legalProfile.brandSlug]);
  const theme = useMemo(
    () =>
      publicThemeStyle(
        resolvePublicBrandTheme({ brandSlug: brand?.slug, brandName: brand?.name })
      ) as CSSProperties,
    [brand?.name, brand?.slug]
  );
  const { attributionForSubmit } = useAttributionBridge({
    enabled: Boolean(publicForm && brand),
    scopeKey: publicForm?.id || formId || "pending-form",
    formToken,
    formId: formId || publicForm?.id || "pending-form",
    brandSlug: brand?.slug || "brand",
    expectedParentOrigin,
    mode,
    sourceCaptureMethod:
      mode === "embed" ? "public_embed_form" : "public_landing_page",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/public/forms/${encodeURIComponent(formToken)}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error("invalid_form");

        const nextForm = normalizeForm(result.form || {});
        const nextBrand = normalizeBrand(result.brand || {});
        const nextServices = (result.treatments || [])
          .map(normalizeService)
          .filter(Boolean) as ServiceOption[];
        const nextPackages = (result.packages || [])
          .map(normalizePackage)
          .filter(Boolean) as PackageOption[];
        const nextLocations = (result.branches || [])
          .map(normalizeLocation)
          .filter(Boolean) as LocationOption[];
        if (!nextForm || !nextBrand || !nextServices.length || !nextPackages.length || !nextLocations.length) {
          throw new Error("incomplete_form");
        }
        if (cancelled) return;
        setPublicForm(nextForm);
        setBrand(nextBrand);
        setServices(nextServices);
        setPackages(nextPackages);
        setLocations(nextLocations);
        setFormData((current) => ({
          ...current,
          treatment_id: nextForm.defaultServiceId,
          package_id: nextForm.defaultPackageId,
          branch_id: nextForm.defaultLocationId,
        }));
        setConfigError("");
      } catch {
        if (!cancelled) setConfigError("這張表格暫時未能使用，請稍後再試。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [formToken]);

  function updateField(key: keyof typeof formData, value: string | boolean) {
    setFormData((current) => {
      if (key === "treatment_id" && typeof value === "string") {
        const nextPackage = packages.find((item) => item.serviceId === value);
        return { ...current, treatment_id: value, package_id: nextPackage?.id || "" };
      }
      return { ...current, [key]: value };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publicForm || !brand || !selectedService || !selectedPackage) return;
    if (!formData.legalConsentAccepted) {
      setSubmitState("error");
      setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
      return;
    }

    setSubmitState("loading");
    setMessage("正在提交資料…");
    try {
      const liveAttribution = await attributionForSubmit();
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          form_token: formToken,
          form_id: formId || publicForm.id,
          treatment_id: selectedService.id,
          package_id: selectedPackage.id,
          first_touch_json: liveAttribution.first_touch_json || {},
          latest_touch_json: liveAttribution.latest_touch_json || {},
          submitted_touch_json: liveAttribution.submitted_touch_json || {},
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "submission_failed");
      setSubmitState("success");
      setMessage("已收到你的登記，團隊會盡快跟進確認。");
      const redirectUrl = safeRedirect(result.success_redirect_url || publicForm.successRedirectUrl);
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error && error.message !== "submission_failed" ? error.message : "未能提交表格，請稍後再試。");
    }
  }

  const isEmbed = mode === "embed";
  return (
    <section
      className={`${className} ${isEmbed ? "mx-auto max-w-xl px-4 py-5" : ""}`}
      style={theme}
    >
      <div className="overflow-hidden rounded-[30px] border border-[var(--public-border)] bg-[var(--public-card)] shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <div className="bg-[var(--public-soft-bg)] px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--public-accent)]">
            {brand?.name || "Growth OS LaunchHub"}
          </p>
          <h2 className="mt-4 text-2xl font-bold text-[var(--public-heading)]">預約服務</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
            填寫資料後，{brand?.name || "相關"} 團隊會跟進確認安排。
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <Notice title="正在載入表格">請稍候，系統正在讀取最新服務設定。</Notice>
          ) : configError ? (
            <Notice title="表格暫時未能使用" tone="warning">{configError}</Notice>
          ) : submitState === "success" ? (
            <Notice title="已收到你的登記" tone="success">{message}</Notice>
          ) : (
            <>
              <section className="rounded-3xl border border-[var(--public-border)] bg-[var(--public-soft-bg)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">已選服務</p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-[var(--public-heading)]">{selectedService?.name}</p>
                    {selectedService?.description ? (
                      <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">{selectedService.description}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--public-cta)]">
                    {priceLabel(selectedPackage)}
                  </p>
                </div>
              </section>

              <form onSubmit={submit} className="mt-5 space-y-5">
                <input
                  name="website"
                  aria-hidden="true"
                  autoComplete="off"
                  className="hidden"
                  tabIndex={-1}
                  value={formData.honeypot}
                  onChange={(event) => updateField("honeypot", event.target.value)}
                />

                <FormSection title="服務資料">
                  <Field label="服務">
                    <select
                      value={formData.treatment_id}
                      onChange={(event) => updateField("treatment_id", event.target.value)}
                      className="input"
                    >
                      {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="套餐">
                    <select
                      value={selectedPackage?.id || ""}
                      onChange={(event) => updateField("package_id", event.target.value)}
                      className="input"
                    >
                      {availablePackages.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} · {priceLabel(item)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="付款方式">
                    <select
                      value={formData.payment_option}
                      onChange={(event) => updateField("payment_option", event.target.value)}
                      className="input"
                    >
                      <option value="booking_only">只預約，稍後確認</option>
                      {selectedPackage?.paymentRequired ? <option value="pay_now">即時付款</option> : null}
                    </select>
                  </Field>
                </FormSection>

                <FormSection title="聯絡資料">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput label="姓名" required value={formData.customer_name} onChange={(value) => updateField("customer_name", value)} />
                    <TextInput label="電話 / WhatsApp" required inputMode="tel" value={formData.phone} onChange={(value) => updateField("phone", value)} />
                  </div>
                  <TextInput label="Email" type="email" value={formData.email} onChange={(value) => updateField("email", value)} />
                </FormSection>

                <FormSection title="預約安排">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="地點">
                      <select
                        value={formData.branch_id}
                        onChange={(event) => updateField("branch_id", event.target.value)}
                        className="input"
                      >
                        {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                    <TextInput label="預約日期" type="date" required value={formData.appointment_date} onChange={(value) => updateField("appointment_date", value)} />
                    <Field label="預約時間">
                      <select
                        value={formData.appointment_time}
                        onChange={(event) => updateField("appointment_time", event.target.value)}
                        className="input"
                      >
                        {["11:00", "12:00", "14:00", "16:00", "18:00", "19:30"].map((time) => <option key={time}>{time}</option>)}
                      </select>
                    </Field>
                  </div>
                </FormSection>

                <section className="rounded-3xl border border-[var(--public-border)] bg-[var(--public-soft-bg)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">條款確認</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--public-muted)]">{LEGAL_CONSENT_HELPER_TEXT}</p>
                  <label className="mt-3 flex items-start gap-3 text-sm font-semibold leading-6 text-[var(--public-heading)]">
                    <input
                      required
                      type="checkbox"
                      checked={formData.legalConsentAccepted}
                      onChange={(event) => updateField("legalConsentAccepted", event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <span>
                      {LEGAL_CONSENT_TEXT}{" "}
                      <a className="font-bold underline" href={legalLinks.privacyPolicyUrl} target="_blank">私隱政策</a>{" · "}
                      <a className="font-bold underline" href={legalLinks.termsUrl} target="_blank">條款及細則</a>{" · "}
                      <a className="font-bold underline" href={legalLinks.disclaimerUrl} target="_blank">免責聲明</a>
                    </span>
                  </label>
                </section>

                {submitState === "error" ? <Notice title="未能提交" tone="warning">{message}</Notice> : null}
                <button
                  disabled={submitState === "loading"}
                  className="w-full rounded-full bg-[var(--public-cta)] px-5 py-3.5 text-sm font-bold text-[var(--public-cta-text)] disabled:opacity-60"
                >
                  {submitState === "loading" ? "提交中…" : "提交預約資料"}
                </button>
              </form>
            </>
          )}

          <footer className="mt-5 border-t border-[var(--public-border)] pt-4 text-center text-xs font-semibold leading-5 text-[var(--public-muted)]">
            <p>{getLegalFooterText(legalProfile)}</p>
            <p className="mt-1">{IMAGE_REFERENCE_FOOTER_NOTE}</p>
          </footer>
        </div>
      </div>
      <style jsx>{`
        .input { margin-top: .5rem; width: 100%; border-radius: 1rem; border: 1px solid var(--public-border); background: white; padding: .75rem 1rem; font-size: .875rem; outline: none; }
      `}</style>
    </section>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-[var(--public-border)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">{title}</p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-[var(--public-heading)]">{label}{children}</label>;
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block text-sm font-bold text-[var(--public-heading)]">
      {label}
      <input
        type={type}
        required={required}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      />
    </label>
  );
}

function Notice({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  const classes =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-sky-200 bg-sky-50 text-sky-900";
  return (
    <section className={`rounded-3xl border p-5 ${classes}`}>
      <h3 className="font-bold">{title}</h3>
      <div className="mt-2 text-sm font-semibold leading-6">{children}</div>
    </section>
  );
}
