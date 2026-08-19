import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818230911_phase_6_secure_customer_confirmation_links.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("phase 6 confirmation migration", () => {
  it("adds awaiting-customer lifecycle and hash-only confirmation links", () => {
    expect(migration).toContain("add value if not exists 'AWAITING_CUSTOMER'");
    expect(migration).toContain("create table if not exists public.confirmation_links");
    expect(migration).toContain("token_hash text not null");
    expect(migration).not.toContain("raw_token");
  });

  it("stores immutable confirmation evidence and terms snapshots", () => {
    expect(migration).toContain("create table if not exists public.booking_confirmations");
    expect(migration).toContain("terms_hash text not null");
    expect(migration).toContain("terms_snapshot jsonb not null");
    expect(migration).toContain("confirmation_terms_snapshot jsonb");
  });

  it("enforces one open link and logical token state constraints", () => {
    expect(migration).toContain("confirmation_links_one_open_link_per_booking_idx");
    expect(migration).toContain("where used_at is null and revoked_at is null");
    expect(migration).toContain("confirmation_links_expires_after_created");
    expect(migration).toContain("confirmation_links_token_hash_format");
  });

  it("keeps confirmation tables unavailable to anon and authenticated table APIs", () => {
    expect(migration).toContain("alter table public.confirmation_links enable row level security");
    expect(migration).toContain("revoke all on public.confirmation_links from anon, authenticated");
    expect(migration).not.toContain("grant select on public.confirmation_links to anon");
    expect(migration).not.toContain("grant select on public.confirmation_links to authenticated");
  });

  it("uses narrow RPC grants for vendor and server-only confirmation operations", () => {
    expect(migration).toContain(
      "grant execute on function public.create_booking_confirmation_link(uuid, text, timestamptz) to authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_confirmation_public_view(text) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.confirm_booking_by_token_hash(text) to service_role",
    );
  });

  it("adds persistent rate-limit storage for public confirmation endpoints", () => {
    expect(migration).toContain("create table if not exists public.confirmation_rate_limits");
    expect(migration).toContain("consume_confirmation_rate_limit");
    expect(migration).toContain("grant execute on function public.consume_confirmation_rate_limit");
  });
});
