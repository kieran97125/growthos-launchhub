import {
  getBranch,
  getBrand,
  getPackage,
  getTreatment,
  packagePriceLabel,
  type ConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";
import { deriveFormConfig } from "@/lib/data/derivedFormConfig";
import { getPublicEmbedPreviewUrl, getPublicPathUrl } from "@/lib/data/appUrl";

export const META_URL_PARAMETER_GUIDE =
  "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&lh_source=meta&lh_medium=paid_social&lh_campaign={{campaign.name}}&lh_content={{ad.name}}&lh_term={{adset.name}}&lh_campaign_id={{campaign.id}}&lh_adset_id={{adset.id}}&lh_ad_id={{ad.id}}&lh_placement={{placement}}";

export function normalizeBrandSlug(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function getBrandPixelId(_brandSlug: string | null | undefined) {
  void _brandSlug;
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
}

export function getBrandSuggestedDomains(_brandSlug: string | null | undefined) {
  void _brandSlug;
  return [] as string[];
}

function slugSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function shortToken(value: string) {
  const parts = value.split("-").filter(Boolean);
  return slugSafe(parts.slice(-2).join("-") || value).slice(0, 18) || "form";
}

function escapeHtmlAttr(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function validPixelValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function buildWixEmbedCode({
  form,
  brandSlug,
  pixelId,
  eventValue,
  eventCurrency = "HKD",
  lazyLoad = true,
}: {
  form: FormSetting;
  brandSlug: string;
  pixelId?: string;
  eventValue?: number | string | null;
  eventCurrency?: string;
  lazyLoad?: boolean;
}) {
  if (!form.publicFormToken) return "";

  const safeBrandSlug = slugSafe(brandSlug || "brand");
  const targetId = `launchhub-${safeBrandSlug}-form-${shortToken(
    form.publicFormToken
  )}`;
  const lines = [
    `<div id="${escapeHtmlAttr(targetId)}"></div>`,
    "",
    `<script`,
    `  src="${escapeHtmlAttr(getPublicPathUrl("/embed/launchhub-form.js?v=20260720-attribution-v1"))}"`,
    `  data-form-token="${escapeHtmlAttr(form.publicFormToken)}"`,
    `  data-brand="${escapeHtmlAttr(safeBrandSlug)}"`,
    `  data-form-id="${escapeHtmlAttr(form.id)}"`,
    `  data-attribution-scope="${escapeHtmlAttr(form.id)}"`,
  ];

  if (pixelId) {
    lines.push(`  data-pixel-id="${escapeHtmlAttr(pixelId)}"`);
    const amount = validPixelValue(eventValue);
    if (amount !== null) {
      lines.push(`  data-pixel-event-value="${escapeHtmlAttr(amount)}"`);
      lines.push(
        `  data-pixel-currency="${escapeHtmlAttr(
          eventCurrency.trim().toUpperCase() || "HKD"
        )}"`
      );
    }
  }

  if (lazyLoad) {
    lines.push(`  data-lazy-load="true"`);
    lines.push(`  data-lazy-root-margin="600px"`);
  }

  lines.push(`  data-target="#${escapeHtmlAttr(targetId)}">`);
  lines.push(`</script>`);

  return lines.join("\n");
}

export function buildWixAttributionBridgeCode(
  formId: string,
  htmlComponentId = "#html1"
) {
  const trackingKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
    "fbclid",
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
    "lh_source",
    "lh_medium",
    "lh_campaign",
    "lh_content",
    "lh_term",
    "lh_campaign_id",
    "lh_adset_id",
    "lh_ad_id",
    "lh_placement",
  ];
  const namespace = `launchhub_wix_attribution_v1_${slugSafe(formId)}`;

  return [
    'import wixLocationFrontend from "wix-location-frontend";',
    'import { local, session } from "wix-storage-frontend";',
    "",
    `const HTML_COMPONENT_ID = ${JSON.stringify(htmlComponentId)};`,
    `const TRACKING_KEYS = ${JSON.stringify(trackingKeys)};`,
    `const FIRST_TOUCH_KEY = ${JSON.stringify(`${namespace}_first`)};`,
    `const LATEST_TOUCH_KEY = ${JSON.stringify(`${namespace}_latest`)};`,
    "",
    "function readJson(storage, key) {",
    "  try {",
    "    const value = storage.getItem(key);",
    "    return value ? JSON.parse(value) : null;",
    "  } catch (error) {",
    "    return null;",
    "  }",
    "}",
    "",
    "function clean(value) {",
    "  const text = typeof value === 'string' ? value.trim() : '';",
    "  return ['undefined', 'null', 'nan', 'none'].includes(text.toLowerCase()) ? '' : text;",
    "}",
    "",
    "function hasTracking(touch) {",
    "  return Boolean(touch && TRACKING_KEYS.some((key) => clean(touch[key])));",
    "}",
    "",
    "function captureCurrentTouch() {",
    "  const query = wixLocationFrontend.query || {};",
    "  const pageUrl = wixLocationFrontend.url;",
    "  const touch = {",
    '    source_capture_method: "wix_page_code",',
    '    attribution_source_used: "wix_parent_bridge",',
    "    parent_url: pageUrl,",
    "    current_page_url: pageUrl,",
    "    landing_page_url: pageUrl,",
    '    page_path: "/" + wixLocationFrontend.path.join("/"),',
    "    captured_at: new Date().toISOString(),",
    "  };",
    "  try { touch.parent_origin = new URL(pageUrl).origin; } catch (error) {}",
    "  TRACKING_KEYS.forEach((key) => {",
    "    const value = clean(query[key]);",
    "    if (value) touch[key] = value;",
    "  });",
    "  return touch;",
    "}",
    "",
    "function buildEnvelope() {",
    "  const current = captureCurrentTouch();",
    "  const storedFirst = readJson(local, FIRST_TOUCH_KEY);",
    "  const storedLatest = readJson(session, LATEST_TOUCH_KEY);",
    "  const first = hasTracking(storedFirst) ? storedFirst : current;",
    "  const latest = hasTracking(current) ? current : (storedLatest || current);",
    "  if (!hasTracking(storedFirst) && hasTracking(current)) {",
    "    local.setItem(FIRST_TOUCH_KEY, JSON.stringify(current));",
    "  }",
    "  if (hasTracking(latest)) {",
    "    session.setItem(LATEST_TOUCH_KEY, JSON.stringify(latest));",
    "  }",
    "  return { first_touch_json: first, latest_touch_json: latest, submitted_touch_json: latest };",
    "}",
    "",
    "function sendAttribution() {",
    "  $w(HTML_COMPONENT_ID).postMessage({",
    '    type: "launchhub_attribution_payload",',
    "    schema_version: 1,",
    "    payload: buildEnvelope(),",
    "  });",
    "}",
    "",
    "$w.onReady(function () {",
    "  const htmlComponent = $w(HTML_COMPONENT_ID);",
    "  htmlComponent.onMessage((event) => {",
    '    if (event.data?.type === "launchhub_wix_attribution_ready") sendAttribution();',
    "  });",
    "  sendAttribution();",
    "  wixLocationFrontend.onChange(() => sendAttribution());",
    "});",
  ].join("\n");
}

export function getFormOperations(config: ConfigurationData, form: FormSetting) {
  const brand = getBrand(config, form.brandId);
  const treatment = getTreatment(config, form.defaultTreatmentId);
  const selectedPackage = getPackage(config, form.defaultPackageId);
  const branch = getBranch(config, form.defaultBranchId);
  const brandSlug = brand?.slug || "brand";
  const pixelId = getBrandPixelId(brandSlug);
  const derivedConfig = deriveFormConfig(config, form);
  const tokenAvailable = Boolean(form.publicFormToken && form.publicTokenAvailable !== false);
  const embedCode = tokenAvailable
    ? buildWixEmbedCode({
        form,
        brandSlug,
        pixelId,
        eventValue: derivedConfig.eventValue,
        eventCurrency: derivedConfig.currency,
      })
    : "";

  return {
    brand,
    treatment,
    package: selectedPackage,
    branch,
    branchLabel: branch?.name || "未設定地點",
    brandSlug,
    pixelId,
    pixelConfigured: Boolean(pixelId),
    tokenAvailable,
    embedCode,
    wixAttributionBridgeCode: buildWixAttributionBridgeCode(form.id),
    previewUrl: tokenAvailable
      ? getPublicEmbedPreviewUrl(form.publicFormToken)
      : "",
    packageLabel: packagePriceLabel(selectedPackage),
    suggestedDomains: getBrandSuggestedDomains(brandSlug),
    derivedConfig,
  };
}
