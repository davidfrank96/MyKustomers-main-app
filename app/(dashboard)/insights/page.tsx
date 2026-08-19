import { redirect } from "next/navigation";
import type { Route } from "next";
import { InsightsView } from "@/features/analytics/components/insights-view";
import { parseAnalyticsRange } from "@/features/analytics/date-ranges";
import { getBusinessInsights } from "@/features/analytics/queries";
import { getCurrentBusinessContext } from "@/lib/auth/server";

type InsightsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const businessContext = await getCurrentBusinessContext();
  const currentBusiness = businessContext.currentBusiness;

  if (!currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const range = parseAnalyticsRange((await searchParams) ?? {});
  const insights = await getBusinessInsights(currentBusiness.id, range);

  return <InsightsView insights={insights} />;
}
