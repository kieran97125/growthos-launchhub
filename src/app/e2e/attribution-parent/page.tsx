import { notFound } from "next/navigation";
import { AttributionParentFixture } from "./AttributionParentFixture";

export const dynamic = "force-dynamic";

export default function AttributionParentPage() {
  if (process.env.LAUNCHHUB_E2E_FIXTURES !== "1") notFound();
  return <AttributionParentFixture />;
}
