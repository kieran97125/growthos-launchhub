import { NextRequest, NextResponse } from "next/server";
import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import {
  buildDerivedSuccessRedirectUrl,
  stripDerivedRedirectParams,
} from "@/lib/data/derivedFormConfig";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

function moneyValue(value: unknown) {
  const amount = typeof value === "string" ? Number(value) : value;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

function buildRuntimeDerivedConfig({
  form,
  brand,
  treatment,
  selectedPackage,
}: {
  form: Record<string, unknown>;
  brand: Record<string, unknown> | null;
  treatment: Record<string, unknown> | null;
  selectedPackage: Record<string, unknown> | null;
}) {
  const storedRedirectUrl =
    typeof form.success_redirect_url === "string"
      ? form.success_redirect_url
      : typeof form.successRedirectUrl === "string"
        ? form.successRedirectUrl
        : "";
  const storedRedirectBaseUrl = stripDerivedRedirectParams(storedRedirectUrl);
  const brandBaseUrl =
    typeof brand?.default_thank_you_url === "string"
      ? brand.default_thank_you_url
      : typeof brand?.defaultThankYouUrl === "string"
        ? brand.defaultThankYouUrl
        : "";
  const successRedirectBaseUrl = storedRedirectBaseUrl || brandBaseUrl;
  const treatmentSlug =
    (typeof treatment?.slug === "string" && treatment.slug.trim()) || "offer";
  const eventValue =
    moneyValue(selectedPackage?.promo_price ?? selectedPackage?.promoPrice) ??
    moneyValue(selectedPackage?.original_price ?? selectedPackage?.originalPrice);
  const currency =
    (typeof selectedPackage?.currency === "string" &&
      String(selectedPackage.currency).trim().toUpperCase()) ||
    "HKD";
  const configuredMode =
    typeof form.conversion_mode === "string"
      ? form.conversion_mode
      : typeof form.conversionMode === "string"
        ? form.conversionMode
        : "";
  const conversionMode =
    configuredMode === "thank_you_redirect"
      ? "thank_you_redirect"
      : configuredMode === "form_submit_pixel"
        ? "form_submit_pixel"
        : storedRedirectUrl
          ? "thank_you_redirect"
          : "form_submit_pixel";
  const successRedirectUrl =
    conversionMode === "thank_you_redirect"
      ? buildDerivedSuccessRedirectUrl({
          baseUrl: successRedirectBaseUrl,
          treatmentSlug,
          eventValue,
        })
      : "";

  return {
    conversion_mode: conversionMode,
    success_redirect_base_url: successRedirectBaseUrl,
    success_redirect_url: successRedirectUrl,
    treatment_slug: treatmentSlug,
    event_value: eventValue,
    currency,
  };
}

function demoSeedFallbackResponse(mode = "demo_seed_fallback") {
  const defaultTreatment =
    alyssaTreatments.find(
      (item) => item.id === alyssaDefaultForm.defaultTreatmentId
    ) ?? null;
  const defaultPackage =
    alyssaPackages.find((item) => item.id === alyssaDefaultForm.defaultPackageId) ?? null;
  const derivedConfig = buildRuntimeDerivedConfig({
    form: alyssaDefaultForm,
    brand: alyssaBrand,
    treatment: defaultTreatment,
    selectedPackage: defaultPackage,
  });

  return NextResponse.json({
    ok: true,
    form: {
      ...alyssaDefaultForm,
      conversion_mode: derivedConfig.conversion_mode,
      success_redirect_url: derivedConfig.success_redirect_url,
    },
    brand: alyssaBrand,
    treatments: alyssaTreatments,
    packages: alyssaPackages,
    branches: alyssaBranches,
    derived_config: derivedConfig,
    mode,
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (token === alyssaDefaultForm.publicFormToken) {
    return demoSeedFallbackResponse();
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("public_form_token", token)
    .maybeSingle();

  if (formError || !form) {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 404 });
  }

  const [{ data: brand }, { data: treatments }, { data: branches }] =
    await Promise.all([
      supabase.from("brands").select("*").eq("id", form.brand_id).single(),
      supabase
        .from("treatments")
        .select("*")
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("branches")
        .select("*")
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  const treatmentIds = (treatments ?? []).map((item) => item.id);
  const { data: packages } =
    treatmentIds.length > 0
      ? await supabase
          .from("packages")
          .select("*")
          .in("treatment_id", treatmentIds)
          .eq("status", "active")
          .order("created_at", { ascending: true })
      : { data: [] };
  const defaultTreatment =
    (treatments ?? []).find((item) => item.id === form.default_treatment_id) ?? null;
  const defaultPackage =
    (packages ?? []).find((item) => item.id === form.default_package_id) ?? null;
  const derivedConfig = buildRuntimeDerivedConfig({
    form,
    brand: brand ?? null,
    treatment: defaultTreatment,
    selectedPackage: defaultPackage,
  });

  return NextResponse.json({
    ok: true,
    form: {
      ...form,
      conversion_mode: derivedConfig.conversion_mode,
      success_redirect_url: derivedConfig.success_redirect_url,
    },
    brand,
    treatments: treatments ?? [],
    packages: packages ?? [],
    branches: branches ?? [],
    derived_config: derivedConfig,
  });
}
