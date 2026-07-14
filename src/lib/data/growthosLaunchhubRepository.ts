import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicFormResolutionFailure =
  | "invalid_token"
  | "not_found"
  | "configuration_unavailable"
  | "configuration_incomplete"
  | "scope_mismatch";

export type GrowthOsBrandRecord = {
  id: string;
  clientId: string;
  code: string;
  name: string;
  slug: string;
  timezone: string;
};

export type GrowthOsServiceRecord = {
  id: string;
  clientId: string;
  brandId: string;
  key: string;
  name: string;
  slug: string;
  description: string;
  status: string;
};

export type GrowthOsPackageRecord = {
  id: string;
  clientId: string;
  brandId: string;
  serviceId: string;
  key: string;
  name: string;
  originalPrice: number | null;
  promoPrice: number | null;
  currency: string;
  paymentRequired: boolean;
  status: string;
};

export type GrowthOsLocationRecord = {
  id: string;
  clientId: string;
  brandId: string;
  key: string;
  name: string;
  slug: string;
  address: string;
  openingHours: unknown;
  status: string;
};

export type GrowthOsLeadFormRecord = {
  id: string;
  clientId: string;
  brandId: string;
  clientKey: string;
  brandKey: string;
  formKey: string;
  title: string;
  isActive: boolean;
  isTestForm: boolean;
  allowedDomains: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type GrowthOsFormConfigRecord = {
  leadFormId: string;
  clientId: string;
  brandId: string;
  defaultServiceId: string;
  defaultPackageId: string;
  defaultLocationId: string;
  conversionMode: "form_submit_pixel" | "thank_you_redirect";
  successRedirectBaseUrl: string;
};

export type ResolvedGrowthOsPublicForm = {
  form: GrowthOsLeadFormRecord;
  config: GrowthOsFormConfigRecord;
  brand: GrowthOsBrandRecord;
  services: GrowthOsServiceRecord[];
  packages: GrowthOsPackageRecord[];
  locations: GrowthOsLocationRecord[];
  defaultService: GrowthOsServiceRecord;
  defaultPackage: GrowthOsPackageRecord;
  defaultLocation: GrowthOsLocationRecord;
};

export type PublicFormResolution =
  | { ok: true; value: ResolvedGrowthOsPublicForm }
  | { ok: false; reason: PublicFormResolutionFailure; detail?: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function slugFromBrandCode(value: unknown) {
  return (
    text(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand"
  );
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.toLowerCase().includes("does not exist"))
  );
}

function failureFromQueryError(
  error: { code?: string; message?: string } | null
): PublicFormResolution {
  if (isMissingRelationError(error)) {
    return {
      ok: false,
      reason: "configuration_unavailable",
      detail: error?.code || "missing_relation",
    };
  }

  return {
    ok: false,
    reason: "configuration_unavailable",
    detail: error?.code || "query_failed",
  };
}

export function hashPublicFormToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function resolveGrowthOsPublicFormByToken(
  supabase: SupabaseClient,
  rawToken: string
): Promise<PublicFormResolution> {
  const token = rawToken.trim();
  if (!token || token.length > 300) {
    return { ok: false, reason: "invalid_token" };
  }

  const tokenHash = hashPublicFormToken(token);
  const { data: formRow, error: formError } = await supabase
    .from("lead_forms")
    .select(
      "id,client_id,brand_id,client_key,brand_key,form_key,title,is_active,is_test_form,allowed_domains,created_at,updated_at"
    )
    .eq("public_form_token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (formError) return failureFromQueryError(formError);
  if (!formRow) return { ok: false, reason: "not_found" };

  const clientId = text(formRow.client_id);
  const brandId = text(formRow.brand_id);
  if (!clientId || !brandId) {
    return { ok: false, reason: "scope_mismatch", detail: "form_scope_missing" };
  }

  const [brandResult, configResult, servicesResult, packagesResult, locationsResult] =
    await Promise.all([
      supabase
        .from("brands")
        .select("id,client_id,brand_code,brand_name,status,timezone")
        .eq("id", brandId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("launchhub_form_configs")
        .select(
          "lead_form_id,client_id,brand_id,default_service_id,default_package_id,default_location_id,conversion_mode,success_redirect_base_url"
        )
        .eq("lead_form_id", formRow.id)
        .eq("client_id", clientId)
        .eq("brand_id", brandId)
        .maybeSingle(),
      supabase
        .from("launchhub_services")
        .select("id,client_id,brand_id,service_key,name,slug,description,status")
        .eq("client_id", clientId)
        .eq("brand_id", brandId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("launchhub_packages")
        .select(
          "id,client_id,brand_id,service_id,package_key,name,original_price,promo_price,currency,payment_required,status"
        )
        .eq("client_id", clientId)
        .eq("brand_id", brandId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("launchhub_locations")
        .select(
          "id,client_id,brand_id,location_key,name,slug,address,opening_hours,status"
        )
        .eq("client_id", clientId)
        .eq("brand_id", brandId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const firstError = [
    brandResult.error,
    configResult.error,
    servicesResult.error,
    packagesResult.error,
    locationsResult.error,
  ].find(Boolean);
  if (firstError) return failureFromQueryError(firstError);

  if (!brandResult.data || !configResult.data) {
    return {
      ok: false,
      reason: "configuration_incomplete",
      detail: !brandResult.data ? "brand_missing" : "form_config_missing",
    };
  }

  const form: GrowthOsLeadFormRecord = {
    id: text(formRow.id),
    clientId,
    brandId,
    clientKey: text(formRow.client_key),
    brandKey: text(formRow.brand_key),
    formKey: text(formRow.form_key),
    title: text(formRow.title) || "Untitled form",
    isActive: Boolean(formRow.is_active),
    isTestForm: Boolean(formRow.is_test_form),
    allowedDomains: textArray(formRow.allowed_domains),
    createdAt: text(formRow.created_at) || null,
    updatedAt: text(formRow.updated_at) || null,
  };

  const brand: GrowthOsBrandRecord = {
    id: text(brandResult.data.id),
    clientId: text(brandResult.data.client_id),
    code: text(brandResult.data.brand_code),
    name: text(brandResult.data.brand_name) || "Unnamed brand",
    slug: slugFromBrandCode(brandResult.data.brand_code),
    timezone: text(brandResult.data.timezone) || "Asia/Hong_Kong",
  };

  const config: GrowthOsFormConfigRecord = {
    leadFormId: text(configResult.data.lead_form_id),
    clientId: text(configResult.data.client_id),
    brandId: text(configResult.data.brand_id),
    defaultServiceId: text(configResult.data.default_service_id),
    defaultPackageId: text(configResult.data.default_package_id),
    defaultLocationId: text(configResult.data.default_location_id),
    conversionMode:
      configResult.data.conversion_mode === "thank_you_redirect"
        ? "thank_you_redirect"
        : "form_submit_pixel",
    successRedirectBaseUrl: text(configResult.data.success_redirect_base_url),
  };

  const services: GrowthOsServiceRecord[] = (servicesResult.data ?? []).map(
    (row) => ({
      id: text(row.id),
      clientId: text(row.client_id),
      brandId: text(row.brand_id),
      key: text(row.service_key),
      name: text(row.name) || "Unnamed service",
      slug: text(row.slug) || "service",
      description: text(row.description),
      status: text(row.status) || "active",
    })
  );

  const packages: GrowthOsPackageRecord[] = (packagesResult.data ?? []).map(
    (row) => ({
      id: text(row.id),
      clientId: text(row.client_id),
      brandId: text(row.brand_id),
      serviceId: text(row.service_id),
      key: text(row.package_key),
      name: text(row.name) || "Unnamed package",
      originalPrice: nullableNumber(row.original_price),
      promoPrice: nullableNumber(row.promo_price),
      currency: text(row.currency).toUpperCase() || "HKD",
      paymentRequired: Boolean(row.payment_required),
      status: text(row.status) || "active",
    })
  );

  const locations: GrowthOsLocationRecord[] = (locationsResult.data ?? []).map(
    (row) => ({
      id: text(row.id),
      clientId: text(row.client_id),
      brandId: text(row.brand_id),
      key: text(row.location_key),
      name: text(row.name) || "Unnamed location",
      slug: text(row.slug) || "location",
      address: text(row.address),
      openingHours: row.opening_hours ?? null,
      status: text(row.status) || "active",
    })
  );

  const defaultService = services.find(
    (item) => item.id === config.defaultServiceId
  );
  const defaultPackage = packages.find(
    (item) => item.id === config.defaultPackageId
  );
  const defaultLocation = locations.find(
    (item) => item.id === config.defaultLocationId
  );

  if (
    !defaultService ||
    !defaultPackage ||
    !defaultLocation ||
    defaultPackage.serviceId !== defaultService.id
  ) {
    return {
      ok: false,
      reason: "configuration_incomplete",
      detail: "default_relationship_invalid",
    };
  }

  const scopeMismatch = [
    brand.clientId !== clientId || brand.id !== brandId,
    config.clientId !== clientId || config.brandId !== brandId,
    ...services.map(
      (item) => item.clientId !== clientId || item.brandId !== brandId
    ),
    ...packages.map(
      (item) => item.clientId !== clientId || item.brandId !== brandId
    ),
    ...locations.map(
      (item) => item.clientId !== clientId || item.brandId !== brandId
    ),
  ].some(Boolean);

  if (scopeMismatch) {
    return { ok: false, reason: "scope_mismatch" };
  }

  return {
    ok: true,
    value: {
      form,
      config,
      brand,
      services,
      packages,
      locations,
      defaultService,
      defaultPackage,
      defaultLocation,
    },
  };
}
