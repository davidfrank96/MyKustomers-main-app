import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818142125_phase_4_customer_management.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("phase 4 customer migration", () => {
  it("creates tenant-owned customers without booking fields", () => {
    expect(migration).toContain("create table if not exists public.customers");
    expect(migration).toContain("business_id uuid not null references public.businesses");
    expect(migration).toContain("archived_at timestamptz");
    expect(migration).not.toContain("booking_id");
    expect(migration).not.toContain("lifetime_spend");
  });

  it("enables RLS and grants only needed browser privileges", () => {
    expect(migration).toContain("alter table public.customers enable row level security");
    expect(migration).toContain("revoke all on public.customers from anon, authenticated");
    expect(migration).toContain("grant select, insert, update on public.customers to authenticated");
    expect(migration).not.toContain("grant delete on public.customers to authenticated");
  });

  it("uses active business membership for customer policies", () => {
    expect(migration).toContain("using (private.is_business_member(business_id))");
    expect(migration).toContain("with check (private.is_business_member(business_id))");
  });

  it("prevents customer business reassignment", () => {
    expect(migration).toContain("private.prevent_customer_business_id_change");
    expect(migration).toContain("customer_business_id_immutable");
  });
});
