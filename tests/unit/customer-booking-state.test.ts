import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () =>
    createClient("https://fixture.invalid", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
}));
import { getCustomerBookingState } from "@/features/customers/queries";

afterEach(() => vi.unstubAllGlobals());

describe("bounded customer booking state", () => {
  it.each([
    [[], false, false],
    [["COMPLETED", "CANCELLED"], true, false],
    [[...Array<string>(1000).fill("COMPLETED"), "CONFIRMED"], true, true],
  ] as const)(
    "finds active bookings beyond the API row cap",
    async (statuses, hasBookings, hasActiveBookings) => {
      const requests: URL[] = [];
      let returnedRows = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = new URL(String(input));
          requests.push(url);
          expect(url.searchParams.get("business_id")).toBe("eq.business-a");
          expect(url.searchParams.get("customer_id")).toBe("eq.customer-a");
          let rows = statuses.map((status, id) => ({ id: String(id), status }));
          if (url.searchParams.get("status") === "not.in.(COMPLETED,CANCELLED)")
            rows = rows.filter((row) => !["COMPLETED", "CANCELLED"].includes(row.status));
          rows = rows.slice(
            0,
            Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000),
          );
          returnedRows += rows.length;
          return new Response(JSON.stringify(rows), {
            headers: { "content-type": "application/json" },
          });
        }),
      );
      expect(await getCustomerBookingState("business-a", "customer-a")).toEqual({
        hasBookings,
        hasActiveBookings,
      });
      expect(returnedRows).toBeLessThanOrEqual(2);
      expect(requests.length).toBeLessThanOrEqual(2);
    },
  );

  it("keeps destructive controls conservative when either lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Unavailable" }), { status: 400 }),
      ),
    );
    expect(await getCustomerBookingState("business-a", "customer-a")).toEqual({
      hasBookings: true,
      hasActiveBookings: true,
    });
  });
});
