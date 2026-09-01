import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260901090000_customer_safe_delete.sql"),
  "utf8",
);

describe("customer safe-delete migration", () => {
  it("keeps permanent deletion behind a narrow owner-only RPC", () => {
    expect(migration).toContain(
      "create or replace function public.delete_customer_if_eligible",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("private.has_business_role(");
    expect(migration).toContain("array['owner']::public.business_member_role[]");
    expect(migration).not.toContain("private.is_business_member(");
    expect(migration).not.toMatch(/grant\s+delete\s+on\s+public\.customers/i);
  });

  it("does not leak customer existence to unauthorized callers", () => {
    expect(migration.match(/customer_not_found_or_unavailable/g)).toHaveLength(2);
    expect(migration).toContain("using errcode = '42501'");
    expect(migration).not.toMatch(/customer_cross_tenant|customer_exists/i);
  });

  it("locks before checking every booking and preserves restrictive FKs", () => {
    expect(migration.indexOf("for update")).toBeLessThan(
      migration.indexOf("from public.bookings as booking"),
    );
    expect(migration).toContain("booking.customer_id = customer_row.id");
    expect(migration).toContain("'booking_history_exists'::text");
    expect(migration).toContain("when foreign_key_violation");
    expect(migration).toContain("'protected_dependency_exists'::text");

    const bookingMigration = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260818222232_phase_5_booking_engine.sql",
      ),
      "utf8",
    );
    expect(bookingMigration).toContain("references public.customers (business_id, id)");
    expect(bookingMigration).toContain("on delete restrict");
  });

  it("records exactly one minimized audit event only after deletion", () => {
    expect(migration).toContain("add value if not exists 'CUSTOMER_DELETED'");
    expect(migration.indexOf("delete from public.customers")).toBeLessThan(
      migration.indexOf("insert into public.audit_logs"),
    );
    expect(migration).toContain("jsonb_build_object('customer_id', customer_row.id)");
    expect(migration).not.toMatch(/customer_row\.(name|email|phone|notes)/);
  });

  it("exposes only authenticated execution", () => {
    expect(migration).toContain(
      "revoke all on function public.delete_customer_if_eligible(uuid)",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.delete_customer_if_eligible(uuid)",
    );
    expect(migration).toContain("to authenticated");
  });
});
