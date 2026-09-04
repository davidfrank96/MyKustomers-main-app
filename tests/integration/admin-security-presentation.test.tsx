import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSecurityHealth } from "@/components/admin/admin-security-health";
import AdminLayout from "@/app/admin/layout";
import AdminPage from "@/app/admin/security/page";
import AdminLoading from "@/app/admin/security/loading";
import { buildAdminHealthView } from "@/features/admin/health";
import { securityFixture, securityStates } from "../fixtures/admin-health";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  pending: false,
  admin: vi.fn(),
  summary: vi.fn(),
  activity: vi.fn(),
  mfa: vi.fn(),
  config: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
  AuthorizationError: class extends Error {},
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  useSelectedLayoutSegment: () => "security",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useTransition: () => [mocks.pending, (action: () => void) => action()],
}));
vi.mock("@/lib/admin/server", () => ({
  requirePlatformAdmin: mocks.admin,
  requirePlatformAdminRole: mocks.role,
  PlatformAdminAuthorizationError: mocks.AuthorizationError,
}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.user }));
vi.mock("@/features/admin/health-server", () => ({
  getAdminHealthSummary: mocks.summary,
  getAdminSecurityActivity: mocks.activity,
  getAdminRuntimeConfiguration: mocks.config,
}));
vi.mock("@/features/admin/security-server", () => ({
  getAdminMfaSecurityStatus: mocks.mfa,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
  const fixture = securityFixture();
  mocks.admin.mockResolvedValue(fixture.admin);
  mocks.role.mockResolvedValue(fixture.admin);
  mocks.user.mockResolvedValue({
    id: fixture.admin.userId,
    email: "review-admin@example.test",
  });
  mocks.summary.mockResolvedValue(fixture.summary);
  mocks.activity.mockResolvedValue(fixture.activity);
  mocks.mfa.mockResolvedValue(fixture.mfa);
  mocks.config.mockReturnValue(fixture.configuration);
});
afterEach(cleanup);

describe("Security & Health presentation preservation", () => {
  it.each(["attention", "healthy", "configured", "unavailable", "stress"] as const)(
    "preserves the actual mapper, service evidence and findings for %s",
    (state) => {
      const props = securityFixture(state);
      const expected = buildAdminHealthView({
        ...props,
        securityActivityAvailable: props.activity !== null,
      });
      const { container } = render(<AdminSecurityHealth {...props} />);
      const summary = screen.getByRole("region", { name: "Platform status" });
      expect(summary.querySelector("[data-health-state]")).toHaveAttribute(
        "data-health-state",
        expected.overall,
      );
      expect(
        within(summary).getByText(String(expected.attentionItems.length)),
      ).toBeInTheDocument();
      expect(within(summary).getByText(expected.securityStatement)).toBeInTheDocument();
      for (const service of expected.services) {
        const card = screen
          .getByRole("heading", { name: service.label })
          .closest("article")!;
        expect(card).toHaveTextContent(service.description);
        expect(card).toHaveTextContent(service.evidence);
        expect(card.querySelector("[data-health-state]")).toHaveAttribute(
          "data-health-state",
          service.state,
        );
      }
      const attention = screen.getByRole("region", { name: "Needs attention" });
      expect(
        [...attention.querySelectorAll("li")].map(
          (li) => li.querySelector("p")?.textContent,
        ),
      ).toEqual(expected.attentionItems.map((item) => item.title));
      expected.attentionItems.forEach((item, index) => {
        const row = attention.querySelectorAll("li")[index];
        expect(row).toHaveTextContent(item.description);
        if (item.href) expect(row.querySelector("a")).toHaveAttribute("href", item.href);
        else expect(row.querySelector("a")).toBeNull();
      });
      if (state === "healthy") {
        expect(container.querySelectorAll("[data-metric-tone]")).toHaveLength(0);
        expect(
          screen.getByText(
            "No current attention signal was detected by the available checks.",
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { name: "Privileged verification active" }),
        ).toBeInTheDocument();
      }
      if (state === "configured")
        expect(screen.getByRole("button", { name: "Verify this session" })).toBeEnabled();
      expect(screen.queryByText(/auto-checked/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "View full activity log" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("preserves exact email/integrity fields and all loaded activity in authoritative order", () => {
    const props = securityFixture("activity");
    props.summary!.email.failed = 3;
    props.summary!.email.stale_sending = 2;
    const { container } = render(<AdminSecurityHealth {...props} />);
    expect(
      [...container.querySelectorAll("[data-health-metric] dd > span:first-child")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["12", "3", "1", "3", "0", "17"]);
    const activity = screen.getByRole("region", { name: "Recent security activity" });
    expect(activity).toHaveAttribute("tabindex", "0");
    expect(activity).toHaveClass("md:max-h-[400px]", "md:overflow-y-auto");
    expect(within(activity).getAllByRole("listitem")).toHaveLength(12);
    expect([...activity.querySelectorAll("time")].map((time) => time.dateTime)).toEqual(
      props.activity!.items.map((item) => item.created_at),
    );
    expect(activity).toHaveTextContent(props.activity!.items[0].reason!);
    expect(
      screen.getByText("Provider acceptance, not recipient delivery."),
    ).toBeInTheDocument();
    expect(screen.getByText(/not redundantly scanned/)).toBeInTheDocument();
    expect(screen.getByText(/Configuration presence does not prove/)).toBeInTheDocument();
  });

  it("retains authoritative evidence during refresh and updates only on new server props", () => {
    const props = securityFixture();
    const { rerender, container } = render(<AdminSecurityHealth {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    mocks.pending = true;
    rerender(<AdminSecurityHealth {...props} />);
    const button = screen.getByRole("button", { name: "Refreshing..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      props.summary!.checked_at,
    );
    mocks.pending = false;
    // A refresh producing no replacement evidence must not invent a new timestamp.
    rerender(<AdminSecurityHealth {...props} />);
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      props.summary!.checked_at,
    );
    const updated = {
      ...props,
      summary: { ...props.summary!, checked_at: "2026-09-04T00:20:00.000Z" },
    };
    rerender(<AdminSecurityHealth {...updated} />);
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      updated.summary.checked_at,
    );
  });

  it("keeps server authorization ahead of reads and isolates rejected sources", async () => {
    mocks.admin.mockRejectedValueOnce(new Error("Denied"));
    await expect(AdminPage()).rejects.toThrow("Denied");
    expect(mocks.summary).not.toHaveBeenCalled();
    mocks.summary.mockRejectedValueOnce(new Error("Unavailable"));
    render(await AdminPage());
    expect(mocks.summary).toHaveBeenCalledTimes(1);
    expect(mocks.activity).toHaveBeenCalledTimes(1);
    expect(mocks.mfa).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Database health unavailable")).toBeInTheDocument();
    expect(screen.getByText("Platform administrator updated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up authenticator" })).toBeEnabled();
  });

  it("does not dump non-allowlisted props, identifiers or configuration secrets", () => {
    const props = securityFixture();
    const sentinel = "NEVER_RENDER_PRIVATE_SENTINEL";
    Object.assign(props.configuration, {
      service_role: sentinel,
      database_url: sentinel,
      oauth_secret: sentinel,
      smtp_password: sentinel,
    });
    Object.assign(props.activity!.items[0], { raw_payload: sentinel });
    const { container } = render(<AdminSecurityHealth {...props} />);
    expect(container.innerHTML).not.toContain(sentinel);
    expect(container.textContent).not.toContain(props.admin.userId);
    expect(container.textContent).not.toContain(props.activity!.items[0].id);
  });

  it("announces loading once without invented evidence or enabled controls", () => {
    const { container } = render(<AdminLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading security and health");
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll("button,a,[data-health-state]")).toHaveLength(0);
    for (const skeleton of container.querySelectorAll(".animate-pulse"))
      expect(skeleton).toHaveClass("motion-reduce:animate-none");
  });

  it.skipIf(process.env.ADMIN_SECURITY_PREVIEW !== "1")(
    "generates local static review fixtures without live backend access",
    async () => {
      const directory = path.resolve("../output/playwright/admin-security");
      fs.mkdirSync(directory, { recursive: true });
      for (const state of securityStates) {
        mocks.pending = state === "refreshing";
        mocks.user.mockResolvedValue({
          email:
            state === "stress"
              ? "long-admin.".repeat(12) + "@example.test"
              : "review-admin@example.test",
        });
        const children =
          state === "loading" ? (
            <AdminLoading />
          ) : (
            <AdminSecurityHealth {...securityFixture(state)} />
          );
        const body = renderToStaticMarkup(await AdminLayout({ children }));
        fs.writeFileSync(
          path.join(directory, state + ".html"),
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOCAL SYNTHETIC SECURITY REVIEW — ${state}</title><link rel="stylesheet" href="/styles.css"></head><body>${body}</body></html>`,
        );
      }
    },
  );
});
