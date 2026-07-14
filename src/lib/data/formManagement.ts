import {
  getConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";

export type ManagedFormInput = {
  formName: string;
  brandId: string;
  defaultTreatmentId: string;
  defaultPackageId: string;
  defaultBranchId: string;
  allowedDomains: string[];
  status: string;
};

export type FormMutationResult = {
  ok: boolean;
  message: string;
  form?: FormSetting;
};

const NATIVE_ADMIN_PENDING_MESSAGE =
  "Growth OS 原生 Form 建立、複製及 Token 輪替流程尚未啟用；為避免寫入舊資料結構，今個版本維持唯讀。";

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

  return {
    ok: true as const,
    domains: Array.from(new Set(origins.filter((item): item is string => Boolean(item)))),
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
  _input: ManagedFormInput
): Promise<FormMutationResult> {
  return { ok: false, message: NATIVE_ADMIN_PENDING_MESSAGE };
}

export async function updateForm(
  _formId: string,
  _input: ManagedFormInput
): Promise<FormMutationResult> {
  return { ok: false, message: NATIVE_ADMIN_PENDING_MESSAGE };
}

export async function duplicateForm(
  _formId: string
): Promise<FormMutationResult> {
  return { ok: false, message: NATIVE_ADMIN_PENDING_MESSAGE };
}
