import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260826004851_admin_safe_failed_email_retry.sql"),
  "utf8",
);
const action = fs.readFileSync(
  path.join(root, "features/admin/email-retry-actions.ts"),
  "utf8",
);
const detail = fs.readFileSync(
  path.join(root, "app/admin/emails/[emailEventId]/page.tsx"),
  "utf8",
);
const list = fs.readFileSync(path.join(root, "app/admin/emails/page.tsx"), "utf8");

const retryClaim = migration.slice(
  migration.indexOf("create or replace function public.claim_platform_admin_email_retry"),
  migration.indexOf("create or replace function public.finalize_email_delivery_attempt"),
);
const finalize = migration.slice(
  migration.indexOf("create or replace function public.finalize_email_delivery_attempt"),
  migration.indexOf("create or replace function public.get_platform_admin_email_event"),
);

describe("admin failed-email retry database boundary", () => {
  it("preserves provider-pinned attempt history without direct client grants", () => {
    expect(migration).toContain("create table public.email_delivery_attempts");
    expect(migration).toContain("unique (email_event_id, attempt_number)");
    expect(migration).toContain("origin = 'ADMIN_RETRY'");
    expect(migration).toContain(
      "revoke all on public.email_delivery_attempts from public, anon, authenticated",
    );
    expect(migration).not.toMatch(
      /grant (select|insert|update|delete)[^;]*email_delivery_attempts[^;]*to (anon|authenticated|public)/i,
    );
  });

  it("makes normal delivery PENDING-only and retry a separate atomic claim", () => {
    const normalClaim = migration.slice(
      migration.indexOf(
        "create or replace function public.claim_email_event(\n  p_email_event_id",
      ),
      migration.indexOf(
        "create or replace function public.claim_email_event(p_email_event_id uuid)",
      ),
    );
    expect(normalClaim).toContain("and status = 'PENDING'");
    expect(normalClaim).not.toContain("status in ('PENDING', 'FAILED')");
    expect(retryClaim).toContain("for update");
    expect(retryClaim).toContain("v_event.status <> 'FAILED'");
    expect(retryClaim).toContain("v_previous_attempt.status <> 'FAILED'");
    expect(retryClaim).toContain("v_previous_attempt.provider <> v_provider");
    expect(retryClaim).toContain("v_event.attempt_count <> p_expected_attempt_count");
    expect(retryClaim).toContain(
      "v_event.failure_code is distinct from p_expected_failure_code",
    );
  });

  it("allows one concurrent claimant and finalizes current-attempt evidence atomically", () => {
    expect(retryClaim).toContain("where id = p_email_event_id\n  for update");
    expect(retryClaim).toContain("set status = 'SENDING'");
    expect(retryClaim).toContain("v_new_attempt_number := v_event.attempt_count + 1");
    expect(finalize).toContain("where id = p_email_event_id\n  for update");
    expect(finalize).toContain("attempt_number = v_event.attempt_count");
    expect(finalize).toContain("v_attempt.status <> 'SENDING'");
  });

  it("persists truthful sanitized requested and result audits", () => {
    for (const eventType of [
      "PLATFORM_ADMIN_EMAIL_RETRY_REQUESTED",
      "PLATFORM_ADMIN_EMAIL_RETRY_SUCCEEDED",
      "PLATFORM_ADMIN_EMAIL_RETRY_FAILED",
    ]) {
      expect(migration).toContain(eventType);
    }
    const auditMetadata = `${retryClaim}\n${finalize}`;
    expect(auditMetadata).toContain("'email_event_id'");
    expect(auditMetadata).toContain("'reason'");
    expect(auditMetadata).toContain("'provider'");
    expect(auditMetadata).not.toMatch(
      /'recipient_email'|'message_body'|'totp'|'provider_key'|'raw_response'/i,
    );
  });

  it("keeps authorization and mutable state out of client input", () => {
    expect(action).toContain('requirePrivilegedPlatformAdmin(["SUPER_ADMIN"])');
    expect(action).toContain("getEmailRetryEligibility");
    expect(action).toContain("claim_platform_admin_email_retry");
    expect(action).not.toMatch(/formData\.get\(["'](provider|status|aal|role|retryable)/);
    expect(detail).toContain("PrivilegedActionDialog");
    expect(detail).not.toMatch(/window\.(confirm|prompt)/);
    expect(list).not.toMatch(/Retry delivery|retryFailedEmailAction/);
  });

  it("does not add failover, bulk retry, or domain-state writes", () => {
    expect(action).toContain("getTransactionalEmailProviderSelectionForName");
    expect(action).not.toMatch(
      /fallback|bulk|switchProvider|RESEND_API_KEY|BREVO_API_KEY/,
    );
    expect(retryClaim).not.toMatch(
      /update public\.(bookings|customers|booking_amendments|booking_addons|feedback)/i,
    );
  });
});
