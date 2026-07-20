import type { TouchPayload } from "./types";
import {
  cleanAttributionText,
  hasExplicitCtwaEvidence,
} from "./values";

export const ATTRIBUTION_BRIDGE_SCHEMA_VERSION = 1;
export const ATTRIBUTION_PAYLOAD_MESSAGE_TYPE =
  "launchhub_attribution_payload";
export const ATTRIBUTION_READY_MESSAGE_TYPE = "launchhub_iframe_ready";
export const WIX_ATTRIBUTION_READY_MESSAGE_TYPE =
  "launchhub_wix_attribution_ready";

export const PUBLIC_ATTRIBUTION_TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
  "fbclid",
  "fbp",
  "fbc",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "placement",
  "ctwa_id",
  "ctwa_clid",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
  "whatsapp_referral_source_id",
] as const;

export const PUBLIC_ATTRIBUTION_ALIAS_MAP = {
  lh_source: "utm_source",
  lh_medium: "utm_medium",
  lh_campaign: "utm_campaign",
  lh_content: "utm_content",
  lh_term: "utm_term",
  lh_campaign_id: "campaign_id",
  lh_adset_id: "adset_id",
  lh_ad_id: "ad_id",
  lh_placement: "placement",
  lh_channel: "utm_source",
} as const;

export const PUBLIC_ATTRIBUTION_PARAM_KEYS = [
  ...PUBLIC_ATTRIBUTION_TRACKING_KEYS,
  ...Object.keys(PUBLIC_ATTRIBUTION_ALIAS_MAP),
] as const;

export type AttributionEnvelope = {
  first_touch_json?: TouchPayload;
  latest_touch_json?: TouchPayload;
  submitted_touch_json?: TouchPayload;
  locked_touch_json?: TouchPayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeAttributionTouch(value: unknown): TouchPayload {
  if (!isRecord(value)) return {};
  const normalized: Record<string, unknown> = {};

  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === "string") {
      const cleaned = cleanAttributionText(item, key.includes("url") ? 2000 : 1000);
      if (cleaned) normalized[key] = cleaned;
      return;
    }
    if (typeof item === "number" || typeof item === "boolean") {
      normalized[key] = item;
    }
  });

  Object.entries(PUBLIC_ATTRIBUTION_ALIAS_MAP).forEach(
    ([alias, canonical]) => {
      const aliasValue = cleanAttributionText(normalized[alias]);
      if (aliasValue && !cleanAttributionText(normalized[canonical])) {
        normalized[canonical] = aliasValue;
      }
    }
  );

  const providerAliases = [
    ["campaign_id", "meta_campaign_id"],
    ["adset_id", "meta_adset_id"],
    ["ad_id", "meta_ad_id"],
  ] as const;
  providerAliases.forEach(([canonical, provider]) => {
    const value =
      cleanAttributionText(normalized[canonical]) ||
      cleanAttributionText(normalized[provider]);
    if (value) {
      normalized[canonical] = value;
      normalized[provider] = value;
    }
  });

  return normalized as TouchPayload;
}

export function hasAttributionTracking(value: unknown) {
  const touch = normalizeAttributionTouch(value) as Record<string, unknown>;
  return PUBLIC_ATTRIBUTION_TRACKING_KEYS.some((key) =>
    Boolean(cleanAttributionText(touch[key]))
  );
}

export function attributionEvidenceScore(value: unknown) {
  const touch = normalizeAttributionTouch(value) as Record<string, unknown>;
  if (hasExplicitCtwaEvidence(touch)) return 500;

  const utmCount = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
  ].filter((key) => cleanAttributionText(touch[key])).length;
  if (utmCount >= 3) return 400 + utmCount;
  if (utmCount > 0) return 300 + utmCount;

  const clickIdCount = [
    "fbclid",
    "gclid",
    "ttclid",
    "msclkid",
    "wbraid",
    "gbraid",
  ].filter((key) => cleanAttributionText(touch[key])).length;
  if (clickIdCount > 0) return 200 + clickIdCount;

  const campaignEvidenceCount = [
    cleanAttributionText(touch.campaign_id),
    cleanAttributionText(touch.adset_id),
    cleanAttributionText(touch.ad_id),
    cleanAttributionText(touch.placement),
  ].filter(Boolean).length;
  if (campaignEvidenceCount > 0) return 150 + campaignEvidenceCount;

  const browserIdCount = ["fbp", "fbc"].filter((key) =>
    cleanAttributionText(touch[key])
  ).length;
  if (
    cleanAttributionText(touch.referrer) ||
    cleanAttributionText(touch.parent_url)
  ) {
    return 50 + browserIdCount;
  }
  if (browserIdCount > 0) return 10 + browserIdCount;
  if (hasAttributionTracking(touch)) return 1;
  return 0;
}

export function mergeAttributionTouches(
  baseValue: unknown,
  incomingValue: unknown
) {
  return normalizeAttributionTouch({
    ...normalizeAttributionTouch(baseValue),
    ...normalizeAttributionTouch(incomingValue),
  });
}

export function strongestAttributionTouch(
  candidates: Array<unknown>
): TouchPayload {
  return candidates.reduce<TouchPayload>((best, candidate) => {
    const normalized = normalizeAttributionTouch(candidate);
    return attributionEvidenceScore(normalized) > attributionEvidenceScore(best)
      ? normalized
      : best;
  }, {});
}

export function normalizeAttributionEnvelope(
  value: unknown
): AttributionEnvelope {
  if (!isRecord(value)) return {};
  return {
    first_touch_json: normalizeAttributionTouch(value.first_touch_json),
    latest_touch_json: normalizeAttributionTouch(value.latest_touch_json),
    submitted_touch_json: normalizeAttributionTouch(value.submitted_touch_json),
    locked_touch_json: normalizeAttributionTouch(value.locked_touch_json),
  };
}

export function hasAttributionEnvelopeTracking(
  value: AttributionEnvelope | null | undefined
) {
  if (!value) return false;
  return [
    value.submitted_touch_json,
    value.latest_touch_json,
    value.first_touch_json,
    value.locked_touch_json,
  ].some(hasAttributionTracking);
}

export function mergeAttributionEnvelopes(
  baseValue: AttributionEnvelope | null | undefined,
  incomingValue: AttributionEnvelope | null | undefined
): AttributionEnvelope {
  const base = normalizeAttributionEnvelope(baseValue);
  const incoming = normalizeAttributionEnvelope(incomingValue);
  const baseFirst = normalizeAttributionTouch(base.first_touch_json);
  const incomingFirst = normalizeAttributionTouch(incoming.first_touch_json);
  const firstTouch = strongestAttributionTouch([baseFirst, incomingFirst]);
  const latestTouch = mergeAttributionTouches(
    base.latest_touch_json,
    incoming.latest_touch_json
  );
  const submittedTouch = mergeAttributionTouches(
    mergeAttributionTouches(base.submitted_touch_json, base.latest_touch_json),
    mergeAttributionTouches(
      incoming.latest_touch_json,
      incoming.submitted_touch_json
    )
  );
  const lockedTouch = strongestAttributionTouch([
    base.locked_touch_json,
    baseFirst,
    incoming.locked_touch_json,
    incomingFirst,
  ]);

  return {
    first_touch_json: firstTouch,
    latest_touch_json: latestTouch,
    submitted_touch_json: submittedTouch,
    locked_touch_json: lockedTouch,
  };
}

export function attributionMessageHasSupportedSchema(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    value.schema_version === undefined ||
    value.schema_version === ATTRIBUTION_BRIDGE_SCHEMA_VERSION
  );
}

export function attributionStorageNamespace(scopeKey: string) {
  const safeScope = scopeKey.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `launchhub:attribution:v1:${safeScope || "unscoped"}`;
}
