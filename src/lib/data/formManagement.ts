import { createHash, randomBytes } from "crypto";
import {
  getBranch,
  getBrand,
  getConfigurationData,
  getPackage,
  getTreatment,
  type ConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";
import { requireActionAccess } from "@/lib/security/internalAccessServer";
import { setOneTimeFormToken } from "@/lib/security/tokenReveal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ManagedFormInput = {
  formName: string;
  brandId: string;
  defaultTreatmentId: string;
  defaultPackageId: string;
  defaultBranchId: string;
  allowedDomains: string[];
  status: "active" | "inactive";
  conversionMode: "form_submit_pixel" | "thank_you_redirect";
  successRedirectBaseUrl: string;
  isTestForm: boolean;
};

export type FormMutationResult = {
  ok: boolean;
  message: string;
  form?: FormSetting;
};

function slugify(value: string, maxLength = 48) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength) || "item"
  );
}

function newRawToken() {
  return `lh_${randomBytes(32).toString("base64url")}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newFormKey(clientKey: string, brandKey: string, formName: string) {
  return `${clientKey}-${brandKey}-${slugify(formName, 30)}-${randomBytes(4).toString("hex")}`;
}

function normalizeOrigin(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned === "localhost" || cleaned === "127.0.0.1") return cleaned;
  if (/^(localhost|127\.0\.0\.1):\d+$/.test(cleaned)) {
    return `http://${cleaned}`;
  }

  try {
    return new URL(cleaned).origin;
  } catch {
    try {
      return new URL(`https://${cleaned}`).origin;
    } catch {
      return null;
    }
  }
}

function normalizeRedirectBase(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) return cleaned;

  try {
    const parsed = new URL(cleaned);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function parseAllowedDomains(value: string) {
  const items = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const origins = items.map(normalizeOrigin);

  if (origins.some((item) => !item)) {
    return {
      ok: false as const,
      domains: [],
      message: "Allowed domains 請使用有效網址，例如 https://example.com",
    };
  }

  const domains = Array.from(
    new Set(origins.filter((item): item is string => Boolean(item)))
  );

  if (domains.length === 0) {
    return {
      ok: false as const,
      domains: [],
      message: "正式 Form 必須設定至少一個 allowed domain。",
    };
  }

  return { ok: true as const, domains };
}

function validateInput(config: ConfigurationData, input: ManagedFormInput) {
  const formName = input.formName.trim().slice(0, 160);
  const brand = getBrand(config, input.brandId);
  const service = getTreatment(config, input.defaultTreatmentId);
  const selectedPackage = getPackage(config, input.defaultPackageId);
  const location = getBranch(config, input.defaultBranchId);
  const redirectBase = normalizeRedirectBase(input.successRedirectBaseUrl);

  if (!formName) return { ok: false as const, message: "請輸入 Form 名稱。" };
  if (!brand) return { ok: false as const, message: "請選擇有效品牌。" };
  if (!service || service.brandId !== brand.id) {
    return { ok: false as const, message: "Service 必須屬於所選品牌。" };
  }
  if (!selectedPackage || selectedPackage.treatmentId !== service.id) {
    return { ok: false as const, message: "Package 必須屬於所選 Service。" };
  }
  if (!location || location.brandId !== brand.id) {
    return { ok: false as const, message: "Location 必須屬於所選品牌。" };
  }
  if (input.allowedDomains.length === 0) {
    return { ok: false as const, message: "請設定至少一個 allowed domain。" };
  }
  if (redirectBase === null) {
    return { ok: false as const, message: "Thank-you URL 格式無效。" };
  }
  if (input.conversionMode === "thank_you_redirect" && !redirectBase) {
    return {
      ok: false as const,
      message: "使用 thank-you redirect 時必須設定 redirect base URL。",
    };
  }

  return {
    ok: true as const,
    value: { ...input, formName, successRedirectBaseUrl: redirectBase },
    brand,
  };
}

async function requireWriteAccess(action: "create_form" | "edit_form") {
  const permission = await requireActionAccess(action);
  return permission.allowed;
}

async function getTenantIdentity(brandId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,client_id,brand_code,status")
    .eq("id", brandId)
    .eq("status", "active")
    .maybeSingle();

  if (brandError || !brand) return null;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id,name,status")
    .eq("id", brand.client_id)
    .eq("status", "active")
    .maybeSingle();

  if (clientError || !client) return null;

  return {
    clientId: String(client.id),
    clientKey: slugify(String(client.name), 36),
    brandId: String(brand.id),
    brandKey: slugify(String(brand.brand_code), 36),
  };
}

function transientForm(input: {
  id: string;
  token: string;
  tokenHash: string;
  formName: string;
  brandId: string;
  serviceId: string;
  packageId: string;
  locationId: string;
  allowedDomains: string[];
  status?: string;
  conversionMode: string;
  successRedirectBaseUrl: string;
  isTestForm: boolean;
}): FormSetting {
  return {
    id: input.id,
    publicFormToken: input.token,
    publicFormTokenHash: input.tokenHash,
    publicTokenAvailable: true,
    brandId: input.brandId,
    formName: input.formName,
    status: input.status || "active",
    allowedDomains: input.allowedDomains,
    defaultTreatmentId: input.serviceId,
    defaultPackageId: input.packageId,
    defaultBranchId: input.locationId,
    conversionMode: input.conversionMode,
    successRedirectUrl: input.successRedirectBaseUrl || null,
    isTestForm: input.isTestForm,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function listForms() {
  const config = await getConfigurationData();
  return config.forms;
}

export async function getFormByIdOrSlug(formId: string) {
  const config = await getConfigurationData();
  const form =
    config.forms.find(
      (item) => item.id === formId || item.publicFormToken === formId
    ) ?? null;

  return { form, config };
}

export async function createForm(
  input: ManagedFormInput
): Promise<FormMutationResult> {
  if (!(await requireWriteAccess("create_form"))) {
    return { ok: false, message: "Admin session 已失效，請重新登入。" };
  }

  const config = await getConfigurationData();
  const validation = validateInput(config, input);
  if (!validation.ok) return { ok: false, message: validation.message };

  const identity = await getTenantIdentity(validation.value.brandId);
  if (!identity) return { ok: false, message: "找不到有效 Client / Brand scope。" };

  const token = newRawToken();
  const tokenHash = hashToken(token);
  const formKey = newFormKey(
    identity.clientKey,
    identity.brandKey,
    validation.value.formName
  );
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("launchhub_admin_create_form", {
    p_client_id: identity.clientId,
    p_brand_id: identity.brandId,
    p_client_key: identity.clientKey,
    p_brand_key: identity.brandKey,
    p_form_key: formKey,
    p_token_hash: tokenHash,
    p_title: validation.value.formName,
    p_allowed_domains: validation.value.allowedDomains,
    p_service_id: validation.value.defaultTreatmentId,
    p_package_id: validation.value.defaultPackageId,
    p_location_id: validation.value.defaultBranchId,
    p_conversion_mode: validation.value.conversionMode,
    p_success_redirect_base_url: validation.value.successRedirectBaseUrl,
    p_is_test_form: validation.value.isTestForm,
  });

  const formId = Array.isArray(data) ? String(data[0]?.form_id || "") : "";
  if (error || !formId) {
    console.error("launchhub_admin_create_form_failed", { code: error?.code || null });
    return { ok: false, message: "建立 Form 失敗，請檢查設定後再試。" };
  }

  await setOneTimeFormToken(formId, token);
  return {
    ok: true,
    message: "Form 已建立。原始 Token 只會顯示 10 分鐘，請立即複製 Embed。",
    form: transientForm({
      id: formId,
      token,
      tokenHash,
      formName: validation.value.formName,
      brandId: identity.brandId,
      serviceId: validation.value.defaultTreatmentId,
      packageId: validation.value.defaultPackageId,
      locationId: validation.value.defaultBranchId,
      allowedDomains: validation.value.allowedDomains,
      conversionMode: validation.value.conversionMode,
      successRedirectBaseUrl: validation.value.successRedirectBaseUrl,
      isTestForm: validation.value.isTestForm,
    }),
  };
}

export async function updateForm(
  formId: string,
  input: ManagedFormInput
): Promise<FormMutationResult> {
  if (!(await requireWriteAccess("edit_form"))) {
    return { ok: false, message: "Admin session 已失效，請重新登入。" };
  }

  const config = await getConfigurationData();
  const existing = config.forms.find((form) => form.id === formId);
  if (!existing) return { ok: false, message: "找不到 Form。" };
  if (input.brandId !== existing.brandId) {
    return { ok: false, message: "現有 Form 不可轉移至另一品牌；請建立新 Form。" };
  }

  const validation = validateInput(config, input);
  if (!validation.ok) return { ok: false, message: validation.message };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("launchhub_admin_update_form", {
    p_form_id: formId,
    p_title: validation.value.formName,
    p_allowed_domains: validation.value.allowedDomains,
    p_is_active: validation.value.status === "active",
    p_service_id: validation.value.defaultTreatmentId,
    p_package_id: validation.value.defaultPackageId,
    p_location_id: validation.value.defaultBranchId,
    p_conversion_mode: validation.value.conversionMode,
    p_success_redirect_base_url: validation.value.successRedirectBaseUrl,
  });

  if (error || data !== true) {
    console.error("launchhub_admin_update_form_failed", { code: error?.code || null });
    return { ok: false, message: "儲存 Form 設定失敗。" };
  }

  return { ok: true, message: "Form 設定已儲存。" };
}

export async function duplicateForm(formId: string): Promise<FormMutationResult> {
  if (!(await requireWriteAccess("create_form"))) {
    return { ok: false, message: "Admin session 已失效，請重新登入。" };
  }

  const { form, config } = await getFormByIdOrSlug(formId);
  if (!form) return { ok: false, message: "找不到 Form。" };
  const brand = getBrand(config, form.brandId);
  if (!brand) return { ok: false, message: "找不到 Form 品牌。" };

  const identity = await getTenantIdentity(form.brandId);
  if (!identity) return { ok: false, message: "找不到有效 Client / Brand scope。" };

  const token = newRawToken();
  const tokenHash = hashToken(token);
  const title = `${form.formName} Copy`;
  const formKey = newFormKey(identity.clientKey, identity.brandKey, title);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("launchhub_admin_duplicate_form", {
    p_source_form_id: form.id,
    p_form_key: formKey,
    p_token_hash: tokenHash,
    p_title: title,
  });

  const newFormId = Array.isArray(data) ? String(data[0]?.form_id || "") : "";
  if (error || !newFormId) {
    console.error("launchhub_admin_duplicate_form_failed", { code: error?.code || null });
    return { ok: false, message: "複製 Form 失敗。" };
  }

  await setOneTimeFormToken(newFormId, token);
  return {
    ok: true,
    message: "Form 已複製並生成新 Token；請立即複製 Embed。",
    form: transientForm({
      id: newFormId,
      token,
      tokenHash,
      formName: title,
      brandId: form.brandId,
      serviceId: form.defaultTreatmentId || "",
      packageId: form.defaultPackageId || "",
      locationId: form.defaultBranchId || "",
      allowedDomains: form.allowedDomains,
      conversionMode: form.conversionMode || "form_submit_pixel",
      successRedirectBaseUrl: form.successRedirectUrl || "",
      isTestForm: form.isTestForm !== false,
    }),
  };
}

export async function rotateFormToken(formId: string): Promise<FormMutationResult> {
  if (!(await requireWriteAccess("edit_form"))) {
    return { ok: false, message: "Admin session 已失效，請重新登入。" };
  }

  const { form } = await getFormByIdOrSlug(formId);
  if (!form) return { ok: false, message: "找不到 Form。" };

  const token = newRawToken();
  const tokenHash = hashToken(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("launchhub_admin_rotate_form_token", {
    p_form_id: form.id,
    p_token_hash: tokenHash,
  });

  if (error || data !== true) {
    console.error("launchhub_admin_rotate_token_failed", { code: error?.code || null });
    return { ok: false, message: "Token 輪替失敗。" };
  }

  await setOneTimeFormToken(form.id, token);
  return {
    ok: true,
    message: "Token 已輪替，舊 Token 即時失效。新 Token 只顯示 10 分鐘。",
    form: { ...form, publicFormToken: token, publicFormTokenHash: tokenHash, publicTokenAvailable: true },
  };
}
