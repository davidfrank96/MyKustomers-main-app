import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818113552_phase_2_auth_tenancy.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("phase 2 auth tenancy migration", () => {
  it("creates only Phase 2 application tables", () => {
    expect(migration).toContain("create table public.profiles");
    expect(migration).toContain("create table public.businesses");
    expect(migration).toContain("create table public.business_members");
    expect(migration).toContain("create table public.audit_logs");
    expect(migration).not.toContain("create table public.customers");
    expect(migration).not.toContain("create table public.bookings");
    expect(migration).not.toContain("create table public.subscriptions");
  });

  it("enables RLS on every Phase 2 table", () => {
    expect(migration).toContain("alter table public.profiles enable row level security");
    expect(migration).toContain("alter table public.businesses enable row level security");
    expect(migration).toContain(
      "alter table public.business_members enable row level security",
    );
    expect(migration).toContain("alter table public.audit_logs enable row level security");
  });

  it("uses private helper functions to avoid recursive membership policies", () => {
    expect(migration).toContain("create or replace function private.is_business_member");
    expect(migration).toContain("create or replace function private.has_business_role");
    expect(migration).toContain("security definer");
    expect(migration).toContain("using (private.is_business_member(business_id))");
  });

  it("does not grant browser roles direct audit log writes", () => {
    expect(migration).toContain("revoke all on public.audit_logs from anon, authenticated");
    expect(migration).not.toContain("grant insert on public.audit_logs to authenticated");
    expect(migration).not.toMatch(/create policy\s+.+\s+on public\.audit_logs/i);
  });
});
