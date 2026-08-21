import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260820143032_inline_customer_booking_creation.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

describe("inline customer booking migration", () => {
  it("creates one authoritative customer-and-booking transaction", () => {
    expect(migration).toContain("create function public.create_booking_with_customer");
    expect(migration).toContain("insert into public.customers");
    expect(migration).toContain("insert into public.bookings");
    expect(migration).toContain("'CUSTOMER_CREATED'");
    expect(migration).toContain("'BOOKING_CREATED'");
  });

  it("derives actor and current business without a business parameter", () => {
    expect(migration).toContain("actor_user_id uuid := auth.uid()");
    expect(migration).toContain("from public.business_members as membership");
    expect(migration).not.toContain("p_business_id");
    expect(migration).not.toContain("p_created_by");
  });

  it("rejects contradictory modes and archived or cross-tenant customers", () => {
    expect(migration).toContain("invalid_existing_customer_payload");
    expect(migration).toContain("invalid_new_customer_payload");
    expect(migration).toContain("customer.business_id = current_business_id");
    expect(migration).toContain("customer.archived_at is null");
  });

  it("uses a hardened security-definer boundary with minimum grants", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(") from public, anon, authenticated;");
    expect(migration).toContain(") to authenticated;");
    expect(migration).not.toContain(") to anon;");
  });

  it("keeps contact values out of audit metadata", () => {
    expect(migration).toContain("'source', 'inline_booking'");
    expect(migration).not.toContain("'email', normalized_customer_email");
    expect(migration).not.toContain("'phone', normalized_customer_phone");
  });
});
