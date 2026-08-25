import { redirect } from "next/navigation";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessOnboardingForm } from "@/components/forms/business-onboarding-form";
import {
  completeBusinessOnboardingAction,
  createAdditionalBusinessAction,
} from "@/features/businesses/actions";
import type { BusinessActionState } from "@/features/businesses/action-state";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getPendingBusinessOnboardingId } from "@/features/businesses/pending-onboarding";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";

export default async function NewBusinessPage() {
  await requireUser("/business/new");
  const [context, pendingBusinessId] = await Promise.all([
    getCurrentBusinessContext(),
    getPendingBusinessOnboardingId(),
  ]);
  const pendingBusiness =
    context.pendingBusinesses.find(
      (business) => business.id === pendingBusinessId && business.role === "owner",
    ) ?? context.pendingBusinesses.find((business) => business.role === "owner");

  if (!context.currentBusiness) {
    redirect("/onboarding" as Route);
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">New business</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
            Add another business
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Create a separate workspace with its own customers, bookings, insights, and
            settings.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessOnboardingForm
            action={createAdditionalBusinessAction}
            completeAction={completeBusinessOnboardingAction}
            initialState={initialState}
            mode="create"
          />
        </CardContent>
      </Card>
    </main>
  );
}
