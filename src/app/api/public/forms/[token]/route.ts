import { NextRequest, NextResponse } from "next/server";
import { buildDerivedSuccessRedirectUrl } from "@/lib/data/derivedFormConfig";
import { resolveGrowthOsPublicFormByToken } from "@/lib/data/growthosLaunchhubRepository";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

function invalidFormResponse() {
  return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 404 });
}

function unavailableResponse() {
  return NextResponse.json(
    { ok: false, error: "form_configuration_unavailable" },
    { status: 503 }
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!hasSupabaseAdminEnv()) {
    return unavailableResponse();
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    console.error("growthos_supabase_boundary_rejected", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return unavailableResponse();
  }

  const resolution = await resolveGrowthOsPublicFormByToken(supabase, token);

  if (!resolution.ok) {
    if (resolution.reason === "not_found" || resolution.reason === "invalid_token") {
      return invalidFormResponse();
    }

    console.error("growthos_public_form_resolution_failed", {
      reason: resolution.reason,
      detail: resolution.detail || null,
    });

    return resolution.reason === "scope_mismatch"
      ? invalidFormResponse()
      : unavailableResponse();
  }

  const {
    form,
    config,
    brand,
    services,
    packages,
    locations,
    defaultService,
    defaultPackage,
  } = resolution.value;

  const eventValue = defaultPackage.promoPrice ?? defaultPackage.originalPrice;
  const successRedirectUrl =
    config.conversionMode === "thank_you_redirect"
      ? buildDerivedSuccessRedirectUrl({
          baseUrl: config.successRedirectBaseUrl,
          treatmentSlug: defaultService.slug,
          eventValue,
        })
      : "";

  return NextResponse.json({
    ok: true,
    form: {
      id: form.id,
      public_form_token: token,
      brand_id: form.brandId,
      form_name: form.title,
      status: form.isActive ? "active" : "inactive",
      allowed_domains: form.allowedDomains,
      default_treatment_id: config.defaultServiceId,
      default_package_id: config.defaultPackageId,
      default_branch_id: config.defaultLocationId,
      conversion_mode: config.conversionMode,
      success_redirect_url: successRedirectUrl,
      created_at: form.createdAt,
      updated_at: form.updatedAt,
      client_id: form.clientId,
      form_key: form.formKey,
      is_test_form: form.isTestForm,
    },
    brand: {
      id: brand.id,
      client_id: brand.clientId,
      name: brand.name,
      slug: brand.slug,
      brand_code: brand.code,
      timezone: brand.timezone,
      default_thank_you_url: config.successRedirectBaseUrl || null,
    },
    treatments: services.map((service) => ({
      id: service.id,
      client_id: service.clientId,
      brand_id: service.brandId,
      service_key: service.key,
      name: service.name,
      slug: service.slug,
      description: service.description,
      status: service.status,
    })),
    packages: packages.map((item) => ({
      id: item.id,
      client_id: item.clientId,
      brand_id: item.brandId,
      treatment_id: item.serviceId,
      service_id: item.serviceId,
      package_key: item.key,
      name: item.name,
      original_price: item.originalPrice,
      promo_price: item.promoPrice,
      currency: item.currency,
      payment_required: item.paymentRequired,
      status: item.status,
    })),
    branches: locations.map((location) => ({
      id: location.id,
      client_id: location.clientId,
      brand_id: location.brandId,
      location_key: location.key,
      name: location.name,
      slug: location.slug,
      address: location.address,
      opening_hours: location.openingHours,
      status: location.status,
    })),
    derived_config: {
      conversion_mode: config.conversionMode,
      success_redirect_base_url: config.successRedirectBaseUrl,
      success_redirect_url: successRedirectUrl,
      treatment_slug: defaultService.slug,
      event_value: eventValue,
      currency: defaultPackage.currency,
    },
    mode: "growthos_data_contract_v1",
  });
}
