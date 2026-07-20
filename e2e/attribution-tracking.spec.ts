import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import {
  PUBLIC_ATTRIBUTION_TRACKING_KEYS,
  attributionEvidenceScore,
  mergeAttributionEnvelopes,
} from "../src/lib/attribution/core";
import { classifyAttribution } from "../src/lib/attribution/classify";

const UTM_QUERY =
  "utm_source=meta&utm_medium=paid_social&utm_campaign=growth_test&utm_content=video_001&fbclid=click123";

const publicFormResponse = {
  ok: true,
  form: {
    id: "e2e-form-id",
    default_treatment_id: "service-1",
    default_package_id: "package-1",
    default_branch_id: "location-1",
    success_redirect_url: "",
  },
  brand: { id: "brand-1", name: "Demo Brand", slug: "demo-brand" },
  treatments: [{ id: "service-1", name: "Demo Service", description: "" }],
  packages: [
    {
      id: "package-1",
      name: "Demo Package",
      service_id: "service-1",
      promo_price: 588,
      original_price: 688,
      currency: "HKD",
      payment_required: false,
    },
  ],
  branches: [{ id: "location-1", name: "Demo Location" }],
};

async function mockPublicApis(page: Page) {
  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/public/forms/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(publicFormResponse),
    });
  });
  await page.route("**/api/public/leads", async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, source_snapshot_id: "snapshot-1" }),
    });
  });
  return () => submittedBody;
}

async function fillAndSubmit(scope: Page | FrameLocator) {
  await scope.getByLabel("姓名").fill("Growth Test Customer");
  await scope.getByLabel("電話 / WhatsApp").fill("91234567");
  await scope.getByLabel("預約日期").fill("2026-08-15");
  await scope.getByRole("checkbox").check();
  await scope.getByRole("button", { name: "提交預約資料" }).click();
}

test("every recognized tracking key has an evidence role", () => {
  for (const key of PUBLIC_ATTRIBUTION_TRACKING_KEYS) {
    expect(attributionEvidenceScore({ [key]: "value" }), key).toBeGreaterThan(0);
  }
  expect(attributionEvidenceScore({ lh_placement: "instagram_story" })).toBeGreaterThan(
    attributionEvidenceScore({ fbp: "fb.1.browser" })
  );
  expect(attributionEvidenceScore({ utm_source: "undefined" })).toBe(0);
});

test("strongest earliest first touch survives browser-only follow-up", () => {
  const merged = mergeAttributionEnvelopes(
    {
      first_touch_json: {
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "first_campaign",
      },
    },
    {
      first_touch_json: {
        parent_url: "https://example.com/clean",
        fbp: "fb.1.browser",
        fbc: "fb.1.browser.click",
      },
    }
  );
  expect(merged.first_touch_json?.utm_campaign).toBe("first_campaign");

  const equalTier = mergeAttributionEnvelopes(
    merged,
    {
      first_touch_json: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "later_campaign",
      },
    }
  );
  expect(equalTier.first_touch_json?.utm_campaign).toBe("first_campaign");
});

test("ordinary Meta campaign IDs are not misclassified as CTWA", () => {
  expect(classifyAttribution({ meta_campaign_id: "123" }).sourceType).toBe(
    "reg_form_utm"
  );
  expect(
    classifyAttribution({
      meta_campaign_id: "123",
      whatsapp_referral_source_id: "ctwa-source",
    }).sourceType
  ).toBe("whatsapp_ctwa");
});

test("direct LaunchHub form submits UTM and click ID", async ({ page }) => {
  const submitted = await mockPublicApis(page);
  await page.goto(`/embed/e2e-form-token?form_id=e2e-form-id&${UTM_QUERY}`);
  await fillAndSubmit(page);
  await expect.poll(submitted).not.toBeNull();
  const body = submitted();
  const first = body?.first_touch_json as Record<string, unknown>;
  const current = body?.submitted_touch_json as Record<string, unknown>;
  expect(first.utm_campaign).toBe("growth_test");
  expect(current.fbclid).toBe("click123");
});

test("nested Wix bridge reaches the LaunchHub iframe", async ({ page }) => {
  const submitted = await mockPublicApis(page);
  await page.goto(`/e2e/attribution-parent?${UTM_QUERY}&placement=instagram_story`);
  const htmlComponent = page.frameLocator('iframe[title="Wix HTML Component"]');
  const form = htmlComponent.frameLocator('iframe[title="Campaign registration form"]');
  await fillAndSubmit(form);
  await expect.poll(submitted).not.toBeNull();
  const body = submitted();
  const first = body?.first_touch_json as Record<string, unknown>;
  const current = body?.submitted_touch_json as Record<string, unknown>;
  expect(first.utm_campaign).toBe("growth_test");
  expect(current.placement).toBe("instagram_story");
  expect(current.source_capture_method).toBe("wix_page_code");
});

test("clean follow-up with Meta browser cookies keeps original UTM", async ({ page }) => {
  const submitted = await mockPublicApis(page);
  await page.goto(`/embed/e2e-form-token?form_id=e2e-form-id&${UTM_QUERY}`);
  await page.context().addCookies([
    { name: "_fbp", value: "fb.1.browser", url: new URL(page.url()).origin },
    { name: "_fbc", value: "fb.1.browser.click", url: new URL(page.url()).origin },
  ]);
  await page.goto("/embed/e2e-form-token?form_id=e2e-form-id");
  await fillAndSubmit(page);
  await expect.poll(submitted).not.toBeNull();
  const first = submitted()?.first_touch_json as Record<string, unknown>;
  expect(first.utm_campaign).toBe("growth_test");
});
