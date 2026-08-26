import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSecurityHealth } from "@/components/admin/admin-security-health";
import type {
  AdminHealthSummary,
  AdminRuntimeConfiguration,
  AdminSecurityActivity,
} from "@/features/admin/health";
import type { AdminMfaSecurityStatus } from "@/features/admin/security";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const summary: AdminHealthSummary = {
  checked_at: "2026-08-26T20:40:00+00:00",
  stale_email_threshold_minutes: 15,
  database: { minimal_read_succeeded: true },
  email: {
    pending: 1,
    sending: 0,
    accepted_24h: 9,
    failed: 0,
    failed_24h: 0,
    failed_attempts_24h: 0,
    stale_pending: 1,
    stale_sending: 0,
    oldest_pending_at: "2026-08-23T15:20:12+00:00",
    oldest_sending_at: null,
  },
  issues: {
    open: 1,
    created_24h: 0,
    oldest_open_at: "2026-08-23T18:07:47+00:00",
  },
  bookings: { overdue: 8 },
  admins: { active: 1, disabled: 0 },
};

const activity: AdminSecurityActivity = {
  items: [
    {
      id: "cb0fe121-5ae2-4635-9a59-ccf026414487",
      event_type: "PLATFORM_ADMIN_CREATED",
      actor: {
        display_name: null,
        email: null,
        source: "CONTROLLED_DATABASE_OPERATOR",
      },
      target: {
        type: "PLATFORM_ADMIN",
        reference: "f6235f62-9d9d-4e15-b05d-da318b2978a5",
      },
      reason: null,
      result: "RECORDED",
      created_at: "2026-08-25T10:00:00+00:00",
    },
  ],
};

const mfa: AdminMfaSecurityStatus = {
  currentLevel: "aal1",
  nextLevel: "aal2",
  verifiedFactors: [
    {
      id: "42504078-8774-4cad-a003-0b349faed691",
      friendlyName: "Authenticator app",
      createdAt: "2026-08-25T10:00:00+00:00",
    },
  ],
  unverifiedFactorCount: 0,
  privilegedAccessReady: false,
};

const configuration: AdminRuntimeConfiguration = {
  environment: "PRODUCTION",
  canonicalDomain: "mykustomers.com",
  canonicalDomainConfigured: true,
  deploymentCommit: "abcdef123456",
  supabasePublicConfigured: true,
  supabaseServiceConfigured: true,
  primaryEmailProvider: { name: "brevo", label: "Brevo", configured: true },
  standbyEmailProvider: { name: "resend", label: "Resend", configured: true },
};

describe("AdminSecurityHealth", () => {
  beforeEach(() => refresh.mockClear());

  it("renders textual health, attention, activity, and truthful email semantics", () => {
    render(
      <AdminSecurityHealth
        admin={{
          userId: "cc9a202b-81ae-4791-8f7d-bf1b49af7829",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        }}
        summary={summary}
        activity={activity}
        mfa={mfa}
        configuration={configuration}
      />,
    );

    expect(screen.getByRole("heading", { name: "Security & Health" })).toBeVisible();
    expect(screen.getAllByText("Attention", { selector: "span" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("heading", { name: "Core services" })).toBeVisible();
    expect(
      screen.getByText("Provider acceptance, not recipient delivery."),
    ).toBeVisible();
    expect(screen.getByText("1 stale outbox event")).toBeVisible();
    expect(screen.getByText("Platform administrator created")).toBeVisible();
    expect(screen.getByText("Actor: Controlled database operator")).toBeVisible();
    expect(screen.getByText("mykustomers.com")).toBeVisible();
    expect(screen.queryByText(/customer received/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secure ✓/i)).not.toBeInTheDocument();
  });

  it("refreshes through application navigation without a write action", () => {
    render(
      <AdminSecurityHealth
        admin={{
          userId: "cc9a202b-81ae-4791-8f7d-bf1b49af7829",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        }}
        summary={summary}
        activity={activity}
        mfa={mfa}
        configuration={configuration}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("isolates an unavailable database source while preserving independent sections", () => {
    render(
      <AdminSecurityHealth
        admin={{
          userId: "cc9a202b-81ae-4791-8f7d-bf1b49af7829",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        }}
        summary={null}
        activity={activity}
        mfa={mfa}
        configuration={configuration}
      />,
    );

    expect(screen.getByText("Database health unavailable")).toBeVisible();
    expect(screen.getByText("Email health evidence is unavailable.")).toBeVisible();
    expect(screen.getByText("Platform administrator created")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Admin account security" })).toBeVisible();
  });
});
