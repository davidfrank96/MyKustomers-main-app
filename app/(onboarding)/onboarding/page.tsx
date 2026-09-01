import { redirect } from "next/navigation";
import type { Route } from "next";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Card, CardContent } from "@/components/ui/card";
import { BusinessOnboardingForm } from "@/components/forms/business-onboarding-form";
import {
  completeBusinessOnboardingAction,
  createBusinessAction,
} from "@/features/businesses/actions";
import type { BusinessActionState } from "@/features/businesses/action-state";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getPendingBusinessOnboardingId } from "@/features/businesses/pending-onboarding";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const [businessContext, pendingBusinessId] = await Promise.all([
    getCurrentBusinessContext(),
    getPendingBusinessOnboardingId(),
  ]);
  const pendingBusiness =
    businessContext.pendingBusinesses.find(
      (business) => business.id === pendingBusinessId && business.role === "owner",
    ) ?? businessContext.pendingBusinesses.find((business) => business.role === "owner");

  if (businessContext.currentBusiness && !pendingBusiness) {
    redirect("/dashboard" as Route);
  }

  const initialState = pendingBusiness
    ? ({
        status: "logo_required",
        message: pendingBusiness.logoPath
          ? "Logo saved. Finishing business setup…"
          : "Business details saved. Upload the required logo to finish setup.",
        pendingBusiness: {
          id: pendingBusiness.id,
          name: pendingBusiness.name,
          logoUrl: getBusinessLogoPublicUrl(pendingBusiness.logoPath),
        },
      } satisfies BusinessActionState)
    : undefined;

  return (
    <WorkspacePage className="max-w-4xl gap-4 pb-28 lg:pb-8">
      <h1 className="break-words text-2xl font-semibold leading-tight">
        Create business
      </h1>

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <BusinessOnboardingForm
            action={createBusinessAction}
            completeAction={completeBusinessOnboardingAction}
            initialState={initialState}
            mode="create"
          />
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
