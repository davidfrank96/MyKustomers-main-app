import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import AdminLayout from "@/app/admin/layout";
import AdminLoading from "@/app/admin/loading";
import AdminError from "@/app/admin/error";
import type { AdminOverview } from "@/features/admin/overview";
import { AdminNavigationLink } from "@/components/admin/admin-navigation";

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
  segment: null as string | null,
  AuthorizationError: class extends Error {},
}));
vi.mock("@/features/admin/queries", () => ({ getAdminOverview: mocks.overview }));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/admin/server", () => ({
  requirePlatformAdminRole: mocks.role,
  PlatformAdminAuthorizationError: mocks.AuthorizationError,
}));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => mocks.segment }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const fixture: AdminOverview = {
  businesses: 12,
  platform_users: 24,
  customers: 180,
  bookings: 240,
  active_bookings: 40,
  due_today: 4,
  overdue: 7,
  completed: 190,
  open_issues: 2,
  email_pending: 1,
  email_sending: 3,
  email_sent: 400,
  email_failed: 5,
  refreshed_at: "2026-09-03T17:27:00.000Z",
};
const routes = [
  ["Overview", "/admin", null],
  ["Businesses", "/admin/businesses", "businesses"],
  ["Users", "/admin/users", "users"],
  ["Bookings", "/admin/bookings", "bookings"],
  ["Issues", "/admin/issues", "issues"],
  ["Email Operations", "/admin/emails", "emails"],
  ["Security & Health", "/admin/security", "security"],
] as const;

beforeEach(() => {
  mocks.segment = null;
  mocks.overview.mockReset().mockResolvedValue(fixture);
  mocks.user
    .mockReset()
    .mockResolvedValue({ id: "test-admin", email: "operator@example.test" });
  mocks.role
    .mockReset()
    .mockResolvedValue({ userId: "test-admin", role: "SUPER_ADMIN", status: "ACTIVE" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("admin overview presentation", () => {
  it("reveals the active link and focused mobile links without intercepting navigation", () => {
    const scroll = vi.fn();
    const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      const { rerender } = render(
        <AdminNavigationLink href="/admin/security" segment="security">
          Security &amp; Health
        </AdminNavigationLink>,
      );
      expect(scroll).not.toHaveBeenCalled();
      fireEvent.focus(screen.getByRole("link"));
      expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
      mocks.segment = "security";
      rerender(
        <AdminNavigationLink href="/admin/security" segment="security">
          Security &amp; Health
        </AdminNavigationLink>,
      );
      expect(scroll).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/security");
    } finally {
      HTMLElement.prototype.scrollIntoView = previous;
    }
  });
  it("renders all existing counts and links from one authoritative read", async () => {
    const { container } = render(await AdminPage());
    expect(mocks.overview).toHaveBeenCalledTimes(1);
    const values = [12, 24, 180, 240, 40, 4, 7, 190, 5, 2, 7, 1, 3, 400, 5];
    expect(
      [...container.querySelectorAll("[data-admin-metric] dd")].map(
        (node) => node.textContent,
      ),
    ).toEqual(values.map((value) => expect.stringContaining(String(value))));
    expect(screen.getByRole("link", { name: "Active bookings" })).toHaveAttribute(
      "href",
      "/admin/bookings?filter=active",
    );
    expect(screen.getByRole("link", { name: "Due today" })).toHaveAttribute(
      "href",
      "/admin/bookings?filter=due_today",
    );
    expect(screen.getByRole("link", { name: "Overdue" })).toHaveAttribute(
      "href",
      "/admin/bookings?filter=overdue",
    );
    expect(screen.getByRole("link", { name: "Completed" })).toHaveAttribute(
      "href",
      "/admin/bookings?filter=completed",
    );
    expect(screen.getByRole("link", { name: "Open booking issues" })).toHaveAttribute(
      "href",
      "/admin/issues?status=OPEN",
    );
    expect(screen.queryByRole("link", { name: "Customers" })).not.toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      fixture.refreshed_at,
    );
    expect(container.querySelector("time")).toHaveTextContent("Sep 3, 2026, 5:27 PM UTC");
    expect(screen.getByText("5 failed, 1 pending")).toBeInTheDocument();
  });

  it("uses warning styling only for positive exception counts", async () => {
    const { container, unmount } = render(await AdminPage());
    expect(
      container.querySelectorAll("[data-admin-metric][data-attention=true]"),
    ).toHaveLength(5);
    unmount();
    mocks.overview.mockResolvedValue({
      ...fixture,
      overdue: 0,
      open_issues: 0,
      email_failed: 0,
    });
    const healthy = render(await AdminPage());
    expect(healthy.container.querySelectorAll("[data-attention=true]")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("0 failed, 1 pending")).toBeInTheDocument();
  });

  it.each(routes)(
    "preserves %s navigation and semantic active state",
    async (label, href, segment) => {
      mocks.segment = segment;
      render(await AdminLayout({ children: <p>Protected content</p> }));
      const nav = screen.getByRole("navigation", { name: "Admin navigation" });
      expect(within(nav).getAllByRole("link")).toHaveLength(7);
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Vendor workspace" })).toHaveAttribute(
        "href",
        "/dashboard",
      );
      expect(screen.getByRole("img", { name: "MyKustomers.com" })).toHaveAttribute(
        "data-brand-logo",
        "horizontal",
      );
      expect(screen.getByText("Super Admin")).toHaveTextContent("Role: Super Admin");
    },
  );

  it("does not render the shell or protected children when the existing role gate denies", async () => {
    mocks.role.mockRejectedValue(new mocks.AuthorizationError());
    render(await AdminLayout({ children: <p>Protected content</p> }));
    expect(mocks.user).toHaveBeenCalledWith("/admin");
    expect(screen.getByRole("heading", { name: "Not authorized" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("keeps unavailable reads as errors, never healthy zero metrics", async () => {
    const error = new Error("Unavailable");
    mocks.overview.mockRejectedValue(error);
    await expect(AdminPage()).rejects.toBe(error);
    const reset = vi.fn();
    render(<AdminError error={error} reset={reset} />);
    expect(
      screen.getByRole("heading", { name: "Platform operations unavailable" }),
    ).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
  });

  it("retains one loading announcement, reduced motion, and no fabricated metrics", () => {
    const { container } = render(<AdminLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading platform operations");
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(30);
    for (const placeholder of container.querySelectorAll(".animate-pulse"))
      expect(placeholder).toHaveClass("motion-reduce:animate-none");
    expect(container.querySelectorAll("a, button, [data-admin-metric]")).toHaveLength(0);
  });

  it.skipIf(process.env.ADMIN_OVERVIEW_PREVIEW !== "1")(
    "optionally generates isolated visual fixtures from the actual page and layout",
    async () => {
      const directory = path.resolve("../output/playwright/admin-overview");
      fs.mkdirSync(directory, { recursive: true });
      for (const state of [
        "attention",
        "healthy",
        "loading",
        "long-email",
        "unavailable",
      ] as const) {
        mocks.overview.mockResolvedValue(
          state === "healthy"
            ? { ...fixture, overdue: 0, open_issues: 0, email_failed: 0 }
            : fixture,
        );
        mocks.user.mockResolvedValue({
          id: "test-admin",
          email:
            state === "long-email"
              ? `${"long-administrator-name.".repeat(7)}@example.test`
              : "operator@example.test",
        });
        if (state === "long-email")
          mocks.overview.mockResolvedValue({
            ...fixture,
            businesses: Number.MAX_SAFE_INTEGER,
            email_sent: Number.MAX_SAFE_INTEGER,
            email_failed: 12500,
          });
        const children =
          state === "loading" ? (
            <AdminLoading />
          ) : state === "unavailable" ? (
            <AdminError error={new Error("Unavailable")} reset={() => {}} />
          ) : (
            await AdminPage()
          );
        const body = renderToStaticMarkup(await AdminLayout({ children }));
        // No Auth session, backend access, or runtime route is created by this harness.
        fs.writeFileSync(
          path.join(directory, `${state}.html`),
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOCAL FIXTURE — Admin overview ${state}</title><link rel="stylesheet" href="/styles.css"></head><body>${body}</body></html>`,
        );
      }
    },
  );
});
