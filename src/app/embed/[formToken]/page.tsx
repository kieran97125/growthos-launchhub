"use client";

import { useParams, useSearchParams } from "next/navigation";
import { GrowthOsPublicLeadForm } from "@/components/public/GrowthOsPublicLeadForm";

function normalizeOrigin(value: string | null) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export default function EmbedFormPage() {
  const params = useParams<{ formToken: string }>();
  const searchParams = useSearchParams();

  return (
    <main className="min-h-screen bg-[var(--public-bg)]">
      <GrowthOsPublicLeadForm
        mode="embed"
        formToken={params.formToken}
        formId={searchParams.get("form_id") || undefined}
        expectedParentOrigin={normalizeOrigin(searchParams.get("parent_origin"))}
      />
    </main>
  );
}
