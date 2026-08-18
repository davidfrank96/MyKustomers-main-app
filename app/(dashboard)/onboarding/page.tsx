import { redirect } from "next/navigation";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessOnboardingForm } from "@/components/forms/business-onboarding-form";
import { createBusinessAction } from "@/features/businesses/actions";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const businessContext = await getCurrentBusinessContext();

  if (businessContext.currentBusiness) {
    redirect("/dashboard" as Route);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">Business setup</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
            Set up your business
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Add the basic identity and contact details your workspace needs before customer
            and booking tools are introduced.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessOnboardingForm action={createBusinessAction} mode="create" />
        </CardContent>
      </Card>
    </main>
  );
}
