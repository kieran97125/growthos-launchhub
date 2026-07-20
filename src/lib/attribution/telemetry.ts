import type { AttributionClassification } from "./types";
import {
  attributionEvidenceScore,
  normalizeAttributionEnvelope,
  type AttributionEnvelope,
} from "./core";
import { cleanAttributionText, hasExplicitCtwaEvidence } from "./values";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
] as const;
const CLICK_ID_KEYS = [
  "fbclid",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
] as const;
const CAMPAIGN_KEYS = [
  "campaign_id",
  "adset_id",
  "ad_id",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
  "placement",
] as const;

export function createAttributionTraceSummary({
  traceId,
  envelope,
  classification,
}: {
  traceId: string;
  envelope: AttributionEnvelope;
  classification: AttributionClassification;
}) {
  const normalized = normalizeAttributionEnvelope(envelope);
  const touch = normalized.submitted_touch_json ?? {};
  return {
    attribution_trace_id: traceId,
    tracking_status: classification.trackingStatus,
    source_type: classification.sourceType,
    audit_reason: classification.auditReason,
    first_touch_evidence_score: attributionEvidenceScore(
      normalized.first_touch_json
    ),
    submitted_touch_evidence_score: attributionEvidenceScore(touch),
    utm_field_count: UTM_KEYS.filter((key) => cleanAttributionText(touch[key]))
      .length,
    click_id_present: CLICK_ID_KEYS.some((key) =>
      cleanAttributionText(touch[key])
    ),
    campaign_evidence_present: CAMPAIGN_KEYS.some((key) =>
      cleanAttributionText(touch[key])
    ),
    ctwa_present: hasExplicitCtwaEvidence(touch),
    parent_payload_present: Boolean(
      cleanAttributionText(touch.parent_origin) ||
        cleanAttributionText(touch.parent_url)
    ),
    storage_status: cleanAttributionText(touch.storage_status, 80),
    capture_method: cleanAttributionText(touch.source_capture_method, 120),
  };
}

export function createSanitizedAttributionPayload({
  traceId,
  envelope,
}: {
  traceId: string;
  envelope: AttributionEnvelope;
}) {
  const normalized = normalizeAttributionEnvelope(envelope);
  return {
    attribution_trace_id: traceId,
    schema_version: 1,
    first_touch_json: normalized.first_touch_json ?? {},
    latest_touch_json: normalized.latest_touch_json ?? {},
    submitted_touch_json: normalized.submitted_touch_json ?? {},
  };
}
