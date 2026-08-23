import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260823151142_booking_integrity_consolidation.sql",
  ),
  "utf8",
).toLowerCase();

describe("booking integrity consolidation migration", () => {
  it("removes only exact duplicate indexes", () => {
    expect(migration).toContain(
      "drop index if exists public.email_events_amendment_event_key",
    );
    expect(migration).toContain(
      "drop index if exists public.bookings_business_created_idx",
    );
    expect(migration).toContain(
      "drop index if exists public.bookings_business_customer_idx",
    );
    expect(migration).toContain(
      "drop index if exists public.feedback_business_submitted_idx",
    );
    expect(migration).not.toMatch(
      /\b(create|alter|drop)\s+(table|function|policy|type)\b/,
    );
    expect(migration).not.toContain("drop constraint");
  });
});
