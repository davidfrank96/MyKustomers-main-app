import fs from "node:fs";
import { describe, expect, it } from "vitest";

const bookingQueries = fs.readFileSync("features/bookings/queries.ts", "utf8");
const dashboard = fs.readFileSync("app/(dashboard)/dashboard/page.tsx", "utf8");
const feedbackQueries = fs.readFileSync("features/feedback/queries.ts", "utf8");
const navigation = fs.readFileSync("components/layout/dashboard-navigation.tsx", "utf8");

describe("authenticated navigation performance policy", () => {
  it("aligns Vercel functions with the configured eu-west-2 Supabase region", () => {
    const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));

    expect(config.regions).toEqual(["lhr1"]);
  });

  it("embeds booking customers instead of adding a sequential follow-up request", () => {
    const customerFeedbackQuery = feedbackQueries.slice(
      feedbackQueries.indexOf("export async function listFeedbackForCustomer"),
      feedbackQueries.indexOf("export async function listBookingIssuesForBooking"),
    );

    expect(bookingQueries).toContain("bookings_business_customer_fk");
    expect(bookingQueries).toContain("bookingListWithCustomerColumns");
    expect(bookingQueries).not.toContain("customersById");
    expect(customerFeedbackQuery).toContain("feedback_booking_business_fk");
    expect(customerFeedbackQuery).not.toContain("const bookingIds = data.map");
  });

  it("streams only the secondary dashboard analytics boundary", () => {
    expect(dashboard).toContain("const monthInsightsPromise = getBusinessInsights");
    expect(dashboard).toContain("<Suspense fallback={<DashboardInsightsFallback />}");
    expect(dashboard).toContain(
      "<DashboardInsightsSummary insightsPromise={monthInsightsPromise} />",
    );
  });

  it("keeps core navigation semantic and available to Next prefetch behavior", () => {
    expect(navigation).toContain('import Link from "next/link"');
    expect(navigation).not.toContain("router.push");
    expect(navigation).not.toContain("prefetch={false}");
  });

  it("does not register a service worker that could cache private routes or RSC", () => {
    const sourceFiles = [
      ...fs.readdirSync("app", { recursive: true }),
      ...fs.readdirSync("components", { recursive: true }),
      ...fs.readdirSync("lib", { recursive: true }),
    ]
      .filter((entry) => typeof entry === "string" && /\.(?:ts|tsx|js|jsx)$/.test(entry))
      .map(String);
    const source = sourceFiles
      .flatMap((entry) => {
        for (const root of ["app", "components", "lib"]) {
          const path = `${root}/${entry}`;
          if (fs.existsSync(path) && fs.statSync(path).isFile()) {
            return [fs.readFileSync(path, "utf8")];
          }
        }
        return [];
      })
      .join("\n");

    expect(fs.existsSync("public/sw.js")).toBe(false);
    expect(source).not.toContain("serviceWorker.register");
  });
});
