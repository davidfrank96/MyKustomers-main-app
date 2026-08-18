import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818222232_phase_5_booking_engine.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("phase 5 booking migration", () => {
  it("creates bookings and status history without confirmation-link tables", () => {
    expect(migration).toContain("create table if not exists public.bookings");
    expect(migration).toContain("create table if not exists public.booking_status_history");
    expect(migration).not.toContain("confirmation_links");
    expect(migration).not.toContain("customer_confirmation");
  });

  it("stores money as integer minor units and enforces financial constraints", () => {
    expect(migration).toContain("total_amount_minor bigint not null");
    expect(migration).toContain("deposit_amount_minor bigint not null");
    expect(migration).toContain("bookings_total_amount_nonnegative");
    expect(migration).toContain("bookings_deposit_not_greater_than_total");
  });

  it("enforces customer/business consistency at the database level", () => {
    expect(migration).toContain("customers_business_id_id_key unique (business_id, id)");
    expect(migration).toContain("foreign key (business_id, customer_id)");
    expect(migration).toContain("references public.customers (business_id, id)");
  });

  it("locks immutable booking ownership and reference fields", () => {
    expect(migration).toContain("booking_business_id_immutable");
    expect(migration).toContain("booking_customer_id_immutable");
    expect(migration).toContain("booking_reference_immutable");
  });

  it("enables RLS and does not grant status-history writes to authenticated users", () => {
    expect(migration).toContain("alter table public.bookings enable row level security");
    expect(migration).toContain(
      "alter table public.booking_status_history enable row level security",
    );
    expect(migration).toContain("grant select, insert, update on public.bookings to authenticated");
    expect(migration).toContain("grant select on public.booking_status_history to authenticated");
    expect(migration).not.toContain(
      "grant select, insert, update on public.booking_status_history to authenticated",
    );
  });
});
