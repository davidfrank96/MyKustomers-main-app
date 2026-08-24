import { redirect } from "next/navigation";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessMembershipList } from "@/components/businesses/business-membership-list";
import { BusinessLogoForm } from "@/components/forms/business-logo-form";
import { BusinessOnboardingForm } from "@/components/forms/business-onboarding-form";
import { updateBusinessProfileAction } from "@/features/businesses/actions";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getCurrentBusinessProfile } from "@/features/businesses/server";

export default async function BusinessPage() {
  const result = await getCurrentBusinessProfile();

  if (result.status === "none") {
    redirect("/onboarding" as Route);
  }

  const isOwner = result.role === "owner";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">Business profile</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
            {result.business.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage the business identity and contact details used by your workspace.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>My businesses</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessMembershipList
            businesses={result.businesses}
            currentBusinessId={result.business.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business logo</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessLogoForm
            businessId={result.business.id}
            businessName={result.business.name}
            currentLogoUrl={getBusinessLogoPublicUrl(result.business.logo_path)}
            isOwner={isOwner}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isOwner ? "Profile settings" : "Profile details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessOnboardingForm
            action={updateBusinessProfileAction.bind(null, result.business.id)}
            mode="edit"
            isOwner={isOwner}
            initialValues={{
              name: result.business.name,
              slug: result.business.slug,
              category: result.business.category,
              description: result.business.description,
              phone: result.business.phone,
              email: result.business.email,
              whatsapp: result.business.whatsapp,
              instagram: result.business.instagram,
              website: result.business.website,
              addressText: result.business.address_text,
            }}
          />
          {!isOwner ? (
            <p className="mt-5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Only owners can edit business profile settings.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
