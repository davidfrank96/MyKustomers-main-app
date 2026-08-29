import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  WorkspacePage,
  WorkspacePageHeader,
} from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessOnboardingForm } from "@/components/forms/business-onboarding-form";
import {
  completeBusinessOnboardingAction,
  createBusinessAction,
} from "@/features/businesses/actions";
import type { BusinessActionState } from "@/features/businesses/action-state";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getPendingBusinessOnboardingId } from "@/features/businesses/pending-onboarding";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";

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
    <WorkspacePage className="max-w-4xl">
      <WorkspacePageHeader
        title="Set up your business"
        description="Add the identity and contact details your workspace needs."
        eyebrow={<Badge variant="outline">Business setup</Badge>}
      />

      <Card>
        <CardHeader className="p-4 pb-0 sm:p-5 sm:pb-0">
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-3 sm:p-5 sm:pt-3">
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
