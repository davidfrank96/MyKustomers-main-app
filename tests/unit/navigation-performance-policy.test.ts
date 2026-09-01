import fs from "node:fs";
import { describe, expect, it } from "vitest";

const bookingQueries = fs.readFileSync("features/bookings/queries.ts", "utf8");
const dashboard = fs.readFileSync("app/(dashboard)/dashboard/page.tsx", "utf8");
const dashboardLayout = fs.readFileSync("app/(dashboard)/layout.tsx", "utf8");
const feedbackQueries = fs.readFileSync("features/feedback/queries.ts", "utf8");
const navigation = fs.readFileSync("components/layout/dashboard-navigation.tsx", "utf8");
const bookingsPage = fs.readFileSync("app/(dashboard)/bookings/page.tsx", "utf8");
const bookingDetail = fs.readFileSync(
  "app/(dashboard)/bookings/[bookingId]/page.tsx",
  "utf8",
);
const customersPage = fs.readFileSync("app/(dashboard)/customers/page.tsx", "utf8");
const customerDetail = fs.readFileSync(
  "app/(dashboard)/customers/[customerId]/page.tsx",
  "utf8",
);

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

  it("acknowledges navigation without replacing semantic links or broad prefetching", () => {
    expect(navigation).toContain("pendingHref");
    expect(navigation).toContain("aria-busy={pending || undefined}");
    expect(navigation).toContain("event.preventDefault()");
    expect(navigation).not.toContain("router.push");
    expect(navigation).not.toContain("router.prefetch");
  });

  it("starts layout auth and tenant resolution together while retaining request caching", () => {
    expect(dashboardLayout).toContain('requireVendorWorkspace("/dashboard")');
    expect(fs.readFileSync("lib/auth/server.ts", "utf8")).toContain(
      "await Promise.all([",
    );
  });

  it("streams list shells before authorized row queries settle", () => {
    expect(bookingsPage).toContain(
      "const resultPromise = listBookingsForBusiness(currentBusiness.id, params)",
    );
    expect(bookingsPage).toContain("<Suspense fallback={<BookingRowsFallback />}>");
    expect(customersPage).toContain(
      "const resultPromise = listCustomersForBusiness(currentBusiness.id, params)",
    );
    expect(customersPage).toContain("<Suspense fallback={<CustomerRowsFallback />}>");
  });

  it("keeps secondary detail reads out of the primary detail boundary", () => {
    expect(customerDetail).toContain(
      "const feedbackPromise = listFeedbackForCustomer(currentBusiness.id, customerId)",
    );
    expect(customerDetail).toContain(
      "<Suspense fallback={<CustomerFeedbackFallback />}>",
    );
    expect(bookingDetail).toContain(
      "const issuesPromise = listBookingIssuesForBooking(currentBusiness.id, booking.id)",
    );
    expect(bookingDetail).toContain("<Suspense fallback={<BookingIssuesFallback />}>");
    expect(bookingDetail).not.toMatch(
      /await Promise\.all\(\[[\s\S]*listBookingIssuesForBooking/,
    );
  });

  it("gives major route loading states a destination identity", () => {
    for (const [path, title] of [
      ["app/(dashboard)/bookings/loading.tsx", "Bookings"],
      ["app/(dashboard)/customers/loading.tsx", "Customers"],
      ["app/(dashboard)/insights/loading.tsx", "Insights"],
      ["app/(dashboard)/business/loading.tsx", "Business profile"],
      ["app/(dashboard)/bookings/[bookingId]/loading.tsx", "Booking details"],
      ["app/(dashboard)/customers/[customerId]/loading.tsx", "Customer details"],
    ]) {
      expect(fs.readFileSync(path, "utf8")).toContain(`title="${title}"`);
    }
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
