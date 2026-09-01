import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Bookings and Customers Load more policy", () => {
  it("uses a fixed first batch of 25 and removes numbered pagination state", () => {
    const bookingValidation = fs.readFileSync("features/bookings/validation.ts", "utf8");
    const customerValidation = fs.readFileSync("features/customers/validation.ts", "utf8");
    const bookingPage = fs.readFileSync("app/(dashboard)/bookings/page.tsx", "utf8");
    const customerPage = fs.readFileSync("app/(dashboard)/customers/page.tsx", "utf8");

    for (const validation of [bookingValidation, customerValidation]) {
      expect(validation).toContain('String(value ?? "25")');
      expect(validation).toContain('page: "1"');
      expect(validation).toContain('limit: "25"');
    }
    for (const page of [bookingPage, customerPage]) {
      expect(page).not.toContain("pageHref");
      expect(page).not.toContain(">Previous<");
      expect(page).not.toContain(">Next<");
      expect(page).toContain("LoadMoreList");
    }
  });

  it("derives tenancy on the server and uses deterministic insertion-safe cursors", () => {
    const bookingRoute = fs.readFileSync("app/api/bookings/list/route.ts", "utf8");
    const customerRoute = fs.readFileSync("app/api/customers/list/route.ts", "utf8");
    const bookingQuery = fs.readFileSync("features/bookings/queries.ts", "utf8");
    const customerQuery = fs.readFileSync("features/customers/queries.ts", "utf8");

    for (const route of [bookingRoute, customerRoute]) {
      expect(route).toContain("getAuthenticatedUser");
      expect(route).toContain("getCurrentBusinessContext(user)");
      expect(route).not.toContain('searchParams.get("businessId")');
      expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
      expect(route).toContain("cursorSchema.safeParse");
    }
    for (const query of [bookingQuery, customerQuery]) {
      expect(query).toContain('.order("created_at", { ascending: false })');
      expect(query).toContain('.order("id", { ascending: false })');
      expect(query).toContain("id.lt.");
    }
  });
});
