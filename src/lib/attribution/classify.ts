import { AttributionClassification, TouchPayload } from "./types";
import {
  cleanAttributionText,
  hasAttributionText,
  hasExplicitCtwaEvidence,
} from "./values";

const utmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
] as const;

const clickIdKeys = [
  "fbclid",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
] as const;

function captureReason(
  touch: TouchPayload,
  direct: string,
  parent: string,
  storage: string
) {
  const method = cleanAttributionText(touch.source_capture_method, 120) || "";
  if (method.includes("storage_recovered")) return storage;
  if (
    method.includes("parent") ||
    method.includes("wix") ||
    hasAttributionText(touch.parent_url)
  ) {
    return parent;
  }
  return direct;
}

export function classifyAttribution(
  touch: TouchPayload,
  options?: {
    parentPayloadMissing?: boolean;
    recoveredFromStorage?: "local" | "session" | null;
  }
): AttributionClassification {
  const utmCount = utmKeys.filter((key) => hasAttributionText(touch[key])).length;
  const hasClickId = clickIdKeys.some((key) => hasAttributionText(touch[key]));
  const hasCampaignEvidence = [
    touch.campaign_id,
    touch.adset_id,
    touch.ad_id,
    touch.meta_campaign_id,
    touch.meta_adset_id,
    touch.meta_ad_id,
    touch.placement,
  ].some(hasAttributionText);
  const hasCtwa = hasExplicitCtwaEvidence(touch);
  const hasReferrer =
    hasAttributionText(touch.referrer) ||
    hasAttributionText(touch.parent_url) ||
    hasAttributionText(touch.landing_page_url) ||
    hasAttributionText(touch.current_page_url);

  if (hasCtwa) {
    return {
      sourceType: "whatsapp_ctwa",
      attributionQuality: "ctwa_detected",
      trackingStatus: "ctwa_detected",
      auditReason: "ctwa_id_detected_from_whatsapp_payload",
    };
  }

  if (utmCount >= 3) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "complete_utm",
      trackingStatus: "complete_utm",
      auditReason: captureReason(
        touch,
        "utm_captured_from_landing_page",
        "utm_captured_from_parent_embed_page",
        options?.recoveredFromStorage === "local"
          ? "utm_recovered_from_local_storage"
          : "utm_recovered_from_session_storage"
      ),
    };
  }

  if (utmCount > 0) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "partial_utm",
      trackingStatus: "partial_utm",
      auditReason: captureReason(
        touch,
        "partial_utm_captured_from_landing_page",
        "partial_utm_captured_from_parent_embed_page",
        options?.recoveredFromStorage === "local"
          ? "partial_utm_recovered_from_local_storage"
          : "partial_utm_recovered_from_session_storage"
      ),
    };
  }

  if (hasClickId) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "click_id_only",
      trackingStatus: "click_id_only",
      auditReason: captureReason(
        touch,
        "click_id_captured_from_landing_page",
        "click_id_captured_from_parent_embed_page",
        options?.recoveredFromStorage === "local"
          ? "click_id_recovered_from_local_storage"
          : "click_id_recovered_from_session_storage"
      ),
    };
  }

  if (hasCampaignEvidence) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "click_id_only",
      trackingStatus: "click_id_only",
      auditReason: captureReason(
        touch,
        "campaign_or_ad_id_captured_from_landing_page",
        "campaign_or_ad_id_captured_from_parent_embed_page",
        options?.recoveredFromStorage === "local"
          ? "campaign_or_ad_id_recovered_from_local_storage"
          : "campaign_or_ad_id_recovered_from_session_storage"
      ),
    };
  }

  if (options?.parentPayloadMissing && !hasReferrer) {
    return {
      sourceType: "organic_unknown",
      attributionQuality: "missing",
      trackingStatus: "missing",
      auditReason: "iframe_missing_parent_payload",
    };
  }

  if (hasReferrer) {
    return {
      sourceType: "organic_unknown",
      attributionQuality: "referrer_only",
      trackingStatus: "referrer_only",
      auditReason: "referrer_captured_without_utm_or_click_id",
    };
  }

  return {
    sourceType: "organic_unknown",
    attributionQuality: "organic_unknown",
    trackingStatus: "organic_unknown",
    auditReason: "no_url_params_no_storage",
  };
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  const numeric = digits.replace(/\D/g, "");
  return numeric.length === 8 ? `+852${numeric}` : numeric;
}

export function cleanText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
