import type { TouchPayload } from "./types";

const INVALID_ATTRIBUTION_VALUES = new Set([
  "undefined",
  "null",
  "nan",
  "none",
]);

export function cleanAttributionText(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  if (!cleaned || INVALID_ATTRIBUTION_VALUES.has(cleaned.toLowerCase())) {
    return null;
  }
  return cleaned.slice(0, maxLength);
}

export function hasAttributionText(value: unknown) {
  return Boolean(cleanAttributionText(value));
}

export function hasExplicitCtwaEvidence(
  touch: TouchPayload | Record<string, unknown> | null | undefined,
  sourceType?: string | null
) {
  if (!touch) return false;
  const record = touch as Record<string, unknown>;
  const source = cleanAttributionText(sourceType)?.toLowerCase();
  const utmMedium = cleanAttributionText(record.utm_medium)?.toLowerCase();
  const lhMedium = cleanAttributionText(record.lh_medium)?.toLowerCase();
  const referralType = cleanAttributionText(
    record.whatsapp_referral_source_type
  )?.toLowerCase();

  return Boolean(
    source === "whatsapp_ctwa" ||
      utmMedium === "ctwa" ||
      lhMedium === "ctwa" ||
      referralType === "ctwa" ||
      cleanAttributionText(record.ctwa_id) ||
      cleanAttributionText(record.ctwa_clid) ||
      cleanAttributionText(record.whatsapp_referral_source_id)
  );
}
