import type { LandingPageConfig } from "@/lib/data/landingPages";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export type BrandSetting = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  whatsappNumber: string | null;
  defaultThankYouUrl: string | null;
};

export type TreatmentSetting = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

export type PackageSetting = {
  id: string;
  treatmentId: string;
  name: string;
  originalPrice: number | string | null;
  promoPrice: number | string | null;
  currency: string;
  paymentRequired: boolean;
  status: string;
};

export type BranchSetting = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  address: string | null;
  openingHours: string | null;
  status: string;
};

export type FormSetting = {
  id: string;
  publicFormToken: string;
  publicFormTokenHash?: string;
  publicTokenAvailable?: boolean;
  brandId: string;
  formName: string;
  status: string;
  allowedDomains: string[];
  defaultTreatmentId: string | null;
  defaultPackageId: string | null;
  defaultBranchId: string | null;
  conversionMode: string | null;
  successRedirectUrl: string | null;
  isTestForm?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LandingPageTemplate = {
  id: string;
  name: string;
  useCase: string;
  recommendedFor: string;
  supportedSections: string[];
  status: "prepared" | "future";
};

export type ConfigurationData = {
  sourceLabel: string;
  brands: BrandSetting[];
  treatments: TreatmentSetting[];
  packages: PackageSetting[];
  branches: BranchSetting[];
  forms: FormSetting[];
  templates: LandingPageTemplate[];
  landingPages: LandingPageConfig[];
};

export const landingPageTemplates: LandingPageTemplate[] = [
  {
    id: "offer-landing-page",
    name: "Offer landing page",
    useCase: "推廣首次體驗、限時優惠或特定 campaign angle。",
    recommendedFor: "Meta / paid social campaign 快速測試",
    supportedSections: ["Hero", "Offer", "Benefits", "Process", "FAQ", "Embedded form"],
    status: "prepared",
  },
  {
    id: "consultation-landing-page",
    name: "Consultation landing page",
    useCase: "用於免費諮詢、需求分析或先 WhatsApp 跟進的 campaign。",
    recommendedFor: "低門檻查詢、教育型 campaign",
    supportedSections: ["Hero", "Pain points", "Consultation flow", "FAQ", "Embedded form"],
    status: "future",
  },
  {
    id: "service-trial-landing-page",
    name: "Service trial landing page",
    useCase: "集中介紹單一服務、體驗價同預約流程。",
    recommendedFor: "服務 trial、A/B offer 測試",
    supportedSections: ["Hero", "Service summary", "Package", "Trust", "FAQ", "Embedded form"],
    status: "future",
  },
  {
    id: "minimal-form-capture-page",
    name: "Minimal form capture page",
    useCase: "只有簡短文案、CTA 同表格，適合快速驗證廣告受眾。",
    recommendedFor: "快速 market angle smoke test",
    supportedSections: ["Headline", "Offer note", "Embedded form"],
    status: "future",
  },
];

function emptyConfiguration(sourceLabel: string): ConfigurationData {
  return {
    sourceLabel,
    brands: [],
    treatments: [],
    packages: [],
    branches: [],
    forms: [],
    templates: landingPageTemplates,
    landingPages: [],
  };
}

function asTextArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugFromBrandCode(value: unknown) {
  return (
    text(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand"
  );
}

function moneyValue(value: number | string | null | undefined, currency = "HKD") {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "未設定";

  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function packagePriceLabel(item: PackageSetting | null | undefined) {
  if (!item) return "未設定";
  return `${item.name} · ${moneyValue(item.promoPrice, item.currency)}`;
}

export function getBrand(data: ConfigurationData, id: string | null | undefined) {
  return data.brands.find((item) => item.id === id) ?? null;
}

export function getTreatment(data: ConfigurationData, id: string | null | undefined) {
  return data.treatments.find((item) => item.id === id) ?? null;
}

export function getPackage(data: ConfigurationData, id: string | null | undefined) {
  return data.packages.find((item) => item.id === id) ?? null;
}

export function getBranch(data: ConfigurationData, id: string | null | undefined) {
  return data.branches.find((item) => item.id === id) ?? null;
}

export function getLinkedForms(
  data: ConfigurationData,
  predicate: (form: FormSetting) => boolean
) {
  return data.forms.filter(predicate);
}

export function getLinkedLandingPages(
  data: ConfigurationData,
  predicate: (page: LandingPageConfig) => boolean
) {
  return data.landingPages.filter(predicate);
}

export async function getConfigurationData(): Promise<ConfigurationData> {
  if (!hasSupabaseAdminEnv()) {
    return emptyConfiguration("Growth OS 資料庫未連接");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [brands, services, packages, locations, leadForms, formConfigs] =
      await Promise.all([
        supabase
          .from("brands")
          .select("id,client_id,brand_code,brand_name,status")
          .eq("status", "active")
          .order("brand_name", { ascending: true }),
        supabase
          .from("launchhub_services")
          .select("id,client_id,brand_id,name,slug,description,status")
          .order("name", { ascending: true }),
        supabase
          .from("launchhub_packages")
          .select(
            "id,client_id,brand_id,service_id,name,original_price,promo_price,currency,payment_required,status"
          )
          .order("name", { ascending: true }),
        supabase
          .from("launchhub_locations")
          .select("id,client_id,brand_id,name,slug,address,opening_hours,status")
          .order("name", { ascending: true }),
        supabase
          .from("lead_forms")
          .select(
            "id,client_id,brand_id,public_form_token_hash,title,is_active,is_test_form,allowed_domains,created_at,updated_at"
          )
          .order("title", { ascending: true }),
        supabase
          .from("launchhub_form_configs")
          .select(
            "lead_form_id,client_id,brand_id,default_service_id,default_package_id,default_location_id,conversion_mode,success_redirect_base_url"
          ),
      ]);

    const firstError = [
      brands.error,
      services.error,
      packages.error,
      locations.error,
      leadForms.error,
      formConfigs.error,
    ].find(Boolean);

    if (firstError) throw firstError;

    const configsByFormId = new Map(
      (formConfigs.data ?? []).map((row) => [String(row.lead_form_id), row])
    );

    const brandSettings: BrandSetting[] = (brands.data ?? []).map((row) => ({
      id: text(row.id),
      name: text(row.brand_name) || "未命名品牌",
      slug: slugFromBrandCode(row.brand_code),
      primaryColor: null,
      secondaryColor: null,
      whatsappNumber: null,
      defaultThankYouUrl: null,
    }));

    return {
      sourceLabel: "Growth OS LaunchHub data contract v1",
      brands: brandSettings,
      treatments: (services.data ?? []).map((row) => ({
        id: text(row.id),
        brandId: text(row.brand_id),
        name: text(row.name) || "未命名服務",
        slug: text(row.slug) || "service",
        description: text(row.description) || null,
        status: text(row.status) || "active",
      })),
      packages: (packages.data ?? []).map((row) => ({
        id: text(row.id),
        treatmentId: text(row.service_id),
        name: text(row.name) || "未命名套餐",
        originalPrice:
          typeof row.original_price === "number" ||
          typeof row.original_price === "string"
            ? row.original_price
            : null,
        promoPrice:
          typeof row.promo_price === "number" ||
          typeof row.promo_price === "string"
            ? row.promo_price
            : null,
        currency: text(row.currency).toUpperCase() || "HKD",
        paymentRequired: Boolean(row.payment_required),
        status: text(row.status) || "active",
      })),
      branches: (locations.data ?? []).map((row) => ({
        id: text(row.id),
        brandId: text(row.brand_id),
        name: text(row.name) || "未命名地點",
        slug: text(row.slug) || "location",
        address: text(row.address) || null,
        openingHours: row.opening_hours
          ? JSON.stringify(row.opening_hours)
          : null,
        status: text(row.status) || "active",
      })),
      forms: (leadForms.data ?? []).flatMap((row) => {
        const config = configsByFormId.get(String(row.id));
        if (!config) return [];

        return [
          {
            id: text(row.id),
            publicFormToken: "",
            publicFormTokenHash: text(row.public_form_token_hash),
            publicTokenAvailable: false,
            brandId: text(row.brand_id),
            formName: text(row.title) || "未命名表格",
            status: row.is_active ? "active" : "inactive",
            allowedDomains: asTextArray(row.allowed_domains),
            defaultTreatmentId: text(config.default_service_id) || null,
            defaultPackageId: text(config.default_package_id) || null,
            defaultBranchId: text(config.default_location_id) || null,
            conversionMode: text(config.conversion_mode) || "form_submit_pixel",
            successRedirectUrl:
              text(config.success_redirect_base_url) || null,
            isTestForm: Boolean(row.is_test_form),
            createdAt: text(row.created_at) || null,
            updatedAt: text(row.updated_at) || null,
          },
        ];
      }),
      templates: landingPageTemplates,
      landingPages: [],
    };
  } catch (error) {
    console.error("growthos_configuration_read_failed", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return emptyConfiguration("Growth OS LaunchHub schema 尚未啟用");
  }
}
