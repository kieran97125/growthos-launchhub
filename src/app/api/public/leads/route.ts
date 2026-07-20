import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  classifyAttribution,
  cleanText,
  normalizePhone,
} from "@/lib/attribution/classify";
import type { TouchPayload } from "@/lib/attribution/types";
import { normalizeAttributionEnvelope } from "@/lib/attribution/core";
import {
  createAttributionTraceSummary,
  createSanitizedAttributionPayload,
} from "@/lib/attribution/telemetry";
import { buildDerivedSuccessRedirectUrl } from "@/lib/data/derivedFormConfig";
import { resolveGrowthOsPublicFormByToken } from "@/lib/data/growthosLaunchhubRepository";
import {
  getLegalLinks,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
} from "@/lib/legal/consent";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

type LeadSubmitPayload = {
  form_token?: string;
  form_id?: string;
  treatment_id?: string;
  package_id?: string;
  branch_id?: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  appointment_date?: string;
  appointment_time?: string;
  payment_option?: "pay_now" | "booking_only";
  first_touch_json?: TouchPayload;
  latest_touch_json?: TouchPayload;
  submitted_touch_json?: TouchPayload;
  honeypot?: string;
  legalConsentAccepted?: boolean | string;
};

const DUPLICATE_WINDOW_MS = 3 * 60 * 1000;
const IP_RATE_WINDOW_MS = 3 * 60 * 1000;
const IP_RATE_LIMIT = 8;
const publicSubmitAttempts = new Map<string, number[]>();

const publicMessages = {
  validation: "未能提交表格，請檢查資料後再試。",
  duplicate: "登記已收到，請稍後再試或等候團隊聯絡。",
  unavailable: "表格暫時未能使用，請稍後再試。",
  spam: "未能提交表格，請稍後再試。",
};

function hasAcceptedLegalConsent(value: LeadSubmitPayload["legalConsentAccepted"]) {
  return value === true;
}

function getStorageRecoverySource(touch: TouchPayload) {
  if (touch.source_capture_method?.includes("local_storage_recovered")) {
    return "local" as const;
  }

  if (touch.source_capture_method?.includes("session_storage_recovered")) {
    return "session" as const;
  }

  return null;
}

function classifySubmittedTouch(touch: TouchPayload) {
  return classifyAttribution(touch, {
    parentPayloadMissing: Object.keys(touch).length === 0,
    recoveredFromStorage: getStorageRecoverySource(touch),
  });
}

function confidenceFromQuality(value: string) {
  if (value === "ctwa_detected" || value === "complete_utm") return "high";
  if (
    value === "storage_recovered" ||
    value === "partial_utm" ||
    value === "click_id_only"
  ) {
    return "medium";
  }
  if (value === "referrer_only") return "low";
  return "unknown";
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;

  try {
    return new URL(cleaned).origin.toLowerCase();
  } catch {
    try {
      return new URL(`https://${cleaned}`).origin.toLowerCase();
    } catch {
      return null;
    }
  }
}

function uniqueOrigins(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map(normalizeOrigin).filter((value): value is string => Boolean(value)))
  );
}

function isAllowedOrigin(
  allowedOrigins: string[],
  candidateOrigin: string,
  rawAllowedDomains: string[]
) {
  if (allowedOrigins.includes(candidateOrigin)) return true;

  try {
    const candidateUrl = new URL(candidateOrigin);
    return rawAllowedDomains.some((domain) => {
      const cleaned = String(domain).trim().toLowerCase();
      return (
        (cleaned === "localhost" || cleaned === "127.0.0.1") &&
        candidateUrl.hostname === cleaned
      );
    });
  } catch {
    return false;
  }
}

function getOriginValidation(
  allowedDomains: string[],
  candidateValues: Array<string | null | undefined>
) {
  const allowedOrigins = uniqueOrigins(allowedDomains);
  const receivedOrigins = uniqueOrigins(candidateValues);

  if (allowedDomains.length === 0) {
    return { allowed: true, allowedOrigins, receivedOrigins };
  }

  const allowed = receivedOrigins.some((origin) =>
    isAllowedOrigin(allowedOrigins, origin, allowedDomains)
  );

  return { allowed, allowedOrigins, receivedOrigins };
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function isIpRateLimited(ip: string | null) {
  if (!ip) return false;

  const now = Date.now();
  const recentAttempts = (publicSubmitAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < IP_RATE_WINDOW_MS
  );

  if (recentAttempts.length >= IP_RATE_LIMIT) {
    publicSubmitAttempts.set(ip, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  publicSubmitAttempts.set(ip, recentAttempts);
  return false;
}

function shortUserAgent(request: NextRequest) {
  return (request.headers.get("user-agent") ?? "").slice(0, 160);
}

function rejectPublicSubmit(
  request: NextRequest,
  status: number,
  error: string,
  message: string,
  input: {
    formKey?: string | null;
    normalizedPhone?: string | null;
  } = {}
) {
  console.warn("[LaunchHub] public_lead_submit_rejected", {
    reason: error,
    form_key: input.formKey || null,
    normalized_phone: input.normalizedPhone || null,
    request_origin: normalizeOrigin(request.headers.get("origin")),
    referer_origin: normalizeOrigin(request.headers.get("referer")),
    user_agent: shortUserAgent(request),
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: false, error, message }, { status });
}

function isValidNormalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function isValidEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isReasonableDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isReasonableTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isMissingContractFunction(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "PGRST202" ||
        error.code === "42883" ||
        error.message?.toLowerCase().includes("launchhub_create_lead"))
  );
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | LeadSubmitPayload
    | null;

  if (!payload) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_json",
      publicMessages.validation
    );
  }

  const formToken = cleanText(payload.form_token, 300) || "";
  const customerName = cleanText(payload.customer_name, 120) || "";
  const phone = cleanText(payload.phone, 80) || "";
  const normalizedPhone = phone ? normalizePhone(phone) : "";
  const email = cleanText(payload.email, 200) || "";
  const appointmentDate = cleanText(payload.appointment_date, 20) || "";
  const appointmentTime = cleanText(payload.appointment_time, 20) || "";

  if (cleanText(payload.honeypot)) {
    return rejectPublicSubmit(request, 400, "spam_rejected", publicMessages.spam);
  }

  if (!hasAcceptedLegalConsent(payload.legalConsentAccepted)) {
    return rejectPublicSubmit(
      request,
      400,
      "legal_consent_missing",
      LEGAL_CONSENT_REQUIRED_MESSAGE,
      { normalizedPhone }
    );
  }

  if (
    !formToken ||
    !customerName ||
    !phone ||
    !isValidNormalizedPhone(normalizedPhone)
  ) {
    return rejectPublicSubmit(
      request,
      400,
      "required_fields_missing",
      publicMessages.validation,
      { normalizedPhone }
    );
  }

  if (!isValidEmail(email)) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_email",
      publicMessages.validation,
      { normalizedPhone }
    );
  }

  if (!appointmentDate || !isReasonableDate(appointmentDate)) {
    return rejectPublicSubmit(
      request,
      400,
      "appointment_date_required",
      "請選擇有效預約日期。",
      { normalizedPhone }
    );
  }

  if (!appointmentTime || !isReasonableTime(appointmentTime)) {
    return rejectPublicSubmit(
      request,
      400,
      "appointment_time_required",
      "請選擇有效預約時間。",
      { normalizedPhone }
    );
  }

  if (isIpRateLimited(getClientIp(request))) {
    return rejectPublicSubmit(
      request,
      429,
      "rate_limited",
      publicMessages.duplicate,
      { normalizedPhone }
    );
  }

  if (!hasSupabaseAdminEnv()) {
    return rejectPublicSubmit(
      request,
      503,
      "service_configuration_invalid",
      publicMessages.unavailable,
      { normalizedPhone }
    );
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    console.error("growthos_supabase_boundary_rejected", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return rejectPublicSubmit(
      request,
      503,
      "service_configuration_invalid",
      publicMessages.unavailable,
      { normalizedPhone }
    );
  }

  const resolution = await resolveGrowthOsPublicFormByToken(supabase, formToken);
  if (!resolution.ok) {
    const status =
      resolution.reason === "not_found" ||
      resolution.reason === "invalid_token" ||
      resolution.reason === "scope_mismatch"
        ? 403
        : 503;

    return rejectPublicSubmit(
      request,
      status,
      status === 403 ? "invalid_form" : "form_configuration_unavailable",
      publicMessages.unavailable,
      { normalizedPhone }
    );
  }

  const {
    form,
    config,
    brand,
    services,
    packages,
    locations,
  } = resolution.value;

  const originValidation = getOriginValidation(form.allowedDomains, [
    request.headers.get("origin"),
    request.headers.get("referer"),
    payload.first_touch_json?.parent_origin,
    payload.first_touch_json?.current_page_url,
    payload.first_touch_json?.landing_page_url,
    payload.latest_touch_json?.parent_origin,
    payload.latest_touch_json?.current_page_url,
    payload.latest_touch_json?.landing_page_url,
    payload.submitted_touch_json?.parent_origin,
    payload.submitted_touch_json?.current_page_url,
    payload.submitted_touch_json?.landing_page_url,
  ]);

  if (!originValidation.allowed) {
    return rejectPublicSubmit(
      request,
      403,
      "domain_not_allowed",
      publicMessages.unavailable,
      { formKey: form.formKey, normalizedPhone }
    );
  }

  const serviceId =
    cleanText(payload.treatment_id, 80) || config.defaultServiceId;
  const packageId = cleanText(payload.package_id, 80) || config.defaultPackageId;
  const locationId = cleanText(payload.branch_id, 80) || config.defaultLocationId;

  const service = services.find((item) => item.id === serviceId);
  const selectedPackage = packages.find((item) => item.id === packageId);
  const location = locations.find((item) => item.id === locationId);

  if (!service) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_service",
      publicMessages.validation,
      { formKey: form.formKey, normalizedPhone }
    );
  }

  if (!selectedPackage || selectedPackage.serviceId !== service.id) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_package",
      publicMessages.validation,
      { formKey: form.formKey, normalizedPhone }
    );
  }

  if (!location) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_location",
      publicMessages.validation,
      { formKey: form.formKey, normalizedPhone }
    );
  }

  const duplicateWindowStart = new Date(
    Date.now() - DUPLICATE_WINDOW_MS
  ).toISOString();
  const { data: shortWindowDuplicate, error: duplicateError } = await supabase
    .from("leads")
    .select("id")
    .eq("client_id", form.clientId)
    .eq("brand_id", form.brandId)
    .eq("form_key", form.formKey)
    .eq("phone", normalizedPhone)
    .gte("created_at", duplicateWindowStart)
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    console.warn("growthos_duplicate_check_failed", {
      code: duplicateError.code,
      form_key: form.formKey,
    });
  }

  if (shortWindowDuplicate) {
    return rejectPublicSubmit(
      request,
      429,
      "duplicate_recent_submission",
      publicMessages.duplicate,
      { formKey: form.formKey, normalizedPhone }
    );
  }

  const attributionEnvelope = normalizeAttributionEnvelope({
    first_touch_json: payload.first_touch_json,
    latest_touch_json: payload.latest_touch_json,
    submitted_touch_json: payload.submitted_touch_json,
  });
  const submittedTouch = attributionEnvelope.submitted_touch_json ?? {};
  const classification = classifySubmittedTouch(submittedTouch);
  const attributionTraceId = randomUUID();
  const attributionTraceSummary = createAttributionTraceSummary({
    traceId: attributionTraceId,
    envelope: attributionEnvelope,
    classification,
  });
  console.info("[LaunchHub] attribution_resolved", attributionTraceSummary);
  const eventValue =
    selectedPackage.promoPrice ?? selectedPackage.originalPrice ?? 0;
  const paymentStatus =
    selectedPackage.paymentRequired && payload.payment_option === "pay_now"
      ? "pending"
      : "booking_only";
  const legalLinks = getLegalLinks(brand.slug);
  const acceptedAt = new Date().toISOString();

  const rawTrackingData = createSanitizedAttributionPayload({
    traceId: attributionTraceId,
    envelope: attributionEnvelope,
  });

  const snapshotPayload = {
    utm_source: cleanText(submittedTouch.utm_source, 300),
    utm_medium: cleanText(submittedTouch.utm_medium, 300),
    utm_campaign: cleanText(submittedTouch.utm_campaign, 500),
    utm_content: cleanText(submittedTouch.utm_content, 500),
    utm_term: cleanText(submittedTouch.utm_term, 500),
    fbclid: cleanText(submittedTouch.fbclid, 1000),
    gclid: cleanText(submittedTouch.gclid, 1000),
    referrer: cleanText(submittedTouch.referrer, 2000),
    landing_page_url: cleanText(submittedTouch.landing_page_url, 2000),
    meta_campaign_id: cleanText(submittedTouch.meta_campaign_id, 300),
    meta_adset_id: cleanText(submittedTouch.meta_adset_id, 300),
    meta_ad_id: cleanText(submittedTouch.meta_ad_id, 300),
    source_rule_matched: classification.sourceType,
    confidence: confidenceFromQuality(classification.attributionQuality),
    audit_reason: classification.auditReason,
    tracking_status: classification.trackingStatus,
    raw_tracking_data: rawTrackingData,
  };

  const rawFormData = {
    form_id: form.id,
    service_id: service.id,
    service_key: service.key,
    service_name: service.name,
    package_id: selectedPackage.id,
    package_key: selectedPackage.key,
    package_name: selectedPackage.name,
    location_id: location.id,
    location_key: location.key,
    location_name: location.name,
    email: email || null,
    payment_option: payload.payment_option || "booking_only",
    currency: selectedPackage.currency,
    source_type: classification.sourceType,
    legal_consent: {
      accepted: true,
      accepted_at: acceptedAt,
      consent_text: LEGAL_CONSENT_TEXT,
      privacy_policy_url: legalLinks.privacyPolicyUrl,
      terms_url: legalLinks.termsUrl,
      disclaimer_url: legalLinks.disclaimerUrl,
    },
  };

  const { data: createdRows, error: createError } = await supabase.rpc(
    "launchhub_create_lead",
    {
      p_form_id: form.id,
      p_client_id: form.clientId,
      p_brand_id: form.brandId,
      p_client_key: form.clientKey,
      p_brand_key: form.brandKey,
      p_form_key: form.formKey,
      p_name: customerName,
      p_phone: normalizedPhone,
      p_booking_date: appointmentDate,
      p_booking_time: appointmentTime,
      p_location_name: location.name,
      p_service_name: service.name,
      p_payment_status: paymentStatus,
      p_raw_form_data: rawFormData,
      p_treatment_price: eventValue,
      p_treatment_price_label: `${selectedPackage.currency} ${eventValue}`,
      p_is_test_data: form.isTestForm,
      p_snapshot: snapshotPayload,
    }
  );

  if (createError || !Array.isArray(createdRows) || !createdRows[0]) {
    console.error("growthos_launchhub_lead_create_failed", {
      code: createError?.code || null,
      contract_missing: isMissingContractFunction(createError),
      form_key: form.formKey,
    });

    return rejectPublicSubmit(
      request,
      503,
      isMissingContractFunction(createError)
        ? "launchhub_contract_not_ready"
        : "lead_create_failed",
      publicMessages.unavailable,
      { formKey: form.formKey, normalizedPhone }
    );
  }

  const leadId = cleanText(createdRows[0].lead_id, 80) || "";
  const sourceSnapshotId =
    cleanText(createdRows[0].source_snapshot_id, 80) || "";
  const successRedirectUrl =
    config.conversionMode === "thank_you_redirect"
      ? buildDerivedSuccessRedirectUrl({
          baseUrl: config.successRedirectBaseUrl,
          treatmentSlug: service.slug,
          eventValue,
        })
      : "";

  return NextResponse.json(
    {
      ok: true,
      lead_id: leadId,
      source_snapshot_id: sourceSnapshotId,
      attribution_trace_id: attributionTraceId,
      source_type: classification.sourceType,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
      success_redirect_url: successRedirectUrl,
      mode: "growthos_data_contract_v1",
    },
    { status: 201 }
  );
}
