import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "supabase/migrations/20260823105232_trusted_confirmation_sharing.sql",
  "utf8",
);
const raceFixMigration = fs.readFileSync(
  "supabase/migrations/20260823111107_trusted_confirmation_open_race_fix.sql",
  "utf8",
);
const actions = fs.readFileSync("features/confirmation-links/actions.ts", "utf8");
const metadataLookup = fs.readFileSync("features/confirmation-links/public.ts", "utf8");

describe("trusted confirmation sharing security", () => {
  it("adds truthful share/open events and an idempotent first-open field", () => {
    expect(migration).toContain("'CONFIRMATION_SHARE_INITIATED'");
    expect(migration).toContain("'CONFIRMATION_OPENED'");
    expect(migration).toContain("add column if not exists first_opened_at timestamptz");
    expect(migration).toContain("confirmation_link.first_opened_at is null");
    expect(migration).toContain("confirmation_link.revoked_at is null");
    expect(migration).toContain("confirmation_link.used_at is null");
  });

  it("keeps the privileged first-open RPC service-only", () => {
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.record_confirmation_link_open(text)",
    );
    expect(migration).toContain(
      "grant execute on function public.record_confirmation_link_open(text) to service_role",
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.record_confirmation_link_open\(text\) to (anon|authenticated)/,
    );
  });

  it("records delayed hydration after atomic confirmation without accepting revoked links", () => {
    expect(raceFixMigration).toContain("confirmation_link.revoked_at is null");
    expect(raceFixMigration).toContain("confirmation_link.used_at is not null");
    expect(raceFixMigration).toContain("from public.booking_confirmations as confirmation");
    expect(raceFixMigration).toContain(
      "confirmation.confirmation_link_id = confirmation_link.id",
    );
    expect(raceFixMigration).toContain(
      "grant execute on function public.record_confirmation_link_open(text) to service_role",
    );
  });

  it("tenant-validates business share events and limits metadata data selection", () => {
    expect(actions).toContain('.eq("business_id", business.id)');
    expect(actions).toContain('.eq("booking_id", bookingId)');
    expect(actions).toContain('eventType: "CONFIRMATION_SHARE_INITIATED"');
    expect(metadataLookup).toContain('.select("name, logo_path")');
    expect(metadataLookup).not.toMatch(/getPublicConfirmationMetadata[\s\S]*customer_name/);
  });
});
