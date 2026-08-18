import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentBusinessContext } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import type { Route } from "next";

type PlaceholderPageProps = {
  title: string;
  phase: string;
};

export async function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  const businessContext = await getCurrentBusinessContext();

  if (!businessContext.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-3">
        <Badge variant="outline">Protected placeholder</Badge>
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
      </div>
      <EmptyState
        title={`${title} is planned.`}
        description={`${phase} owns this product area. Phase 2 only verifies authentication, tenancy, and authorization boundaries.`}
      />
    </main>
  );
}
