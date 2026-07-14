import {
  getBrand,
  getPackage,
  getTreatment,
  type ConfigurationData,
  type FormSetting,
  type PackageSetting,
} from "@/lib/data/configuration";

export type FormConversionMode = "form_submit_pixel" | "thank_you_redirect";

export type DerivedFormConfig = {
  conversionMode: FormConversionMode;
  successRedirectBaseUrl: string;
  successRedirectUrl: string;
  treatmentSlug: string;
  eventValue: number | null;
  currency: string;
  storedRedirectIsStale: boolean;
  staleReasons: string[];
};

const DERIVED_QUERY_KEYS = ["submitted", "treatment", "value"] as const;

function numericMoneyValue(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : value;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

export function getPackageEventValue(item: PackageSetting | null | undefined) {
  return numericMoneyValue(item?.promoPrice) ?? numericMoneyValue(item?.originalPrice);
}

function serializeUrl(url: URL, wasAbsolute: boolean) {
  if (wasAbsolute) return url.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

function parseHttpOrRelativeUrl(value: string | null | undefined) {
  const cleaned = value?.trim() || "";
  if (!cleaned) return null;

  const wasAbsolute = /^https?:\/\//i.test(cleaned);

  try {
    const url = new URL(cleaned, "https://launchhub.invalid");
    if (wasAbsolute && !["http:", "https:"].includes(url.protocol)) return null;
    if (!wasAbsolute && !cleaned.startsWith("/")) return null;
    return { url, wasAbsolute };
  } catch {
    return null;
  }
}

export function stripDerivedRedirectParams(value: string | null | undefined) {
  const parsed = parseHttpOrRelativeUrl(value);
  if (!parsed) return "";

  DERIVED_QUERY_KEYS.forEach((key) => parsed.url.searchParams.delete(key));
  return serializeUrl(parsed.url, parsed.wasAbsolute);
}

export function buildDerivedSuccessRedirectUrl({
  baseUrl,
  treatmentSlug,
  eventValue,
}: {
  baseUrl: string | null | undefined;
  treatmentSlug: string | null | undefined;
  eventValue: number | string | null | undefined;
}) {
  const parsed = parseHttpOrRelativeUrl(baseUrl);
  if (!parsed) return "";

  parsed.url.searchParams.set("submitted", "1");
  parsed.url.searchParams.set("treatment", treatmentSlug?.trim() || "offer");

  const amount = numericMoneyValue(eventValue);
  if (amount === null) {
    parsed.url.searchParams.delete("value");
  } else {
    parsed.url.searchParams.set("value", String(Math.round(amount)));
  }

  return serializeUrl(parsed.url, parsed.wasAbsolute);
}

function normalizedComparableUrl(value: string | null | undefined) {
  const parsed = parseHttpOrRelativeUrl(value);
  if (!parsed) return "";
  return serializeUrl(parsed.url, parsed.wasAbsolute);
}

function getStaleReasons({
  storedUrl,
  derivedUrl,
  treatmentSlug,
  eventValue,
}: {
  storedUrl: string;
  derivedUrl: string;
  treatmentSlug: string;
  eventValue: number | null;
}) {
  if (!storedUrl || !derivedUrl) return [];

  const parsed = parseHttpOrRelativeUrl(storedUrl);
  if (!parsed) return ["stored_redirect_invalid"];

  const reasons: string[] = [];
  if (parsed.url.searchParams.get("submitted") !== "1") {
    reasons.push("submitted_flag_stale");
  }
  if (parsed.url.searchParams.get("treatment") !== treatmentSlug) {
    reasons.push("treatment_slug_stale");
  }

  const expectedValue = eventValue === null ? null : String(Math.round(eventValue));
  const storedValue = parsed.url.searchParams.get("value");
  if (storedValue !== expectedValue) reasons.push("offer_value_stale");

  if (normalizedComparableUrl(storedUrl) !== normalizedComparableUrl(derivedUrl)) {
    const storedBase = stripDerivedRedirectParams(storedUrl);
    const derivedBase = stripDerivedRedirectParams(derivedUrl);
    if (storedBase !== derivedBase) reasons.push("redirect_base_stale");
  }

  return Array.from(new Set(reasons));
}

export function deriveFormConfig(config: ConfigurationData, form: FormSetting): DerivedFormConfig {
  const brand = getBrand(config, form.brandId);
  const treatment = getTreatment(config, form.defaultTreatmentId);
  const selectedPackage = getPackage(config, form.defaultPackageId);
  const eventValue = getPackageEventValue(selectedPackage);
  const treatmentSlug = treatment?.slug?.trim() || "offer";
  const currency = selectedPackage?.currency?.trim().toUpperCase() || "HKD";
  const storedRedirectUrl = form.successRedirectUrl?.trim() || "";
  const brandBaseUrl = brand?.defaultThankYouUrl?.trim() || "";
  const successRedirectBaseUrl =
    brandBaseUrl || stripDerivedRedirectParams(storedRedirectUrl);
  const successRedirectUrl = buildDerivedSuccessRedirectUrl({
    baseUrl: successRedirectBaseUrl,
    treatmentSlug,
    eventValue,
  });
  const conversionMode: FormConversionMode =
    form.conversionMode === "thank_you_redirect" || Boolean(storedRedirectUrl)
      ? "thank_you_redirect"
      : "form_submit_pixel";
  const staleReasons = getStaleReasons({
    storedUrl: storedRedirectUrl,
    derivedUrl: successRedirectUrl,
    treatmentSlug,
    eventValue,
  });

  return {
    conversionMode,
    successRedirectBaseUrl,
    successRedirectUrl,
    treatmentSlug,
    eventValue,
    currency,
    storedRedirectIsStale: staleReasons.length > 0,
    staleReasons,
  };
}
