import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/admin/emails/page";
import Layout from "@/app/admin/layout";
import Loading from "@/app/admin/emails/loading";
import {
  getAdminEmailHealth,
  parseAdminEmailParams,
} from "@/features/admin/email-operations";
import { emailFixture, emailStates } from "../fixtures/admin-email";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  config: vi.fn(),
  replace: vi.fn(),
  user: vi.fn(),
  admin: vi.fn(),
  pending: false,
  query: "",
}));
vi.mock("@/features/admin/queries", () => ({
  listAdminEmailOperations: mocks.list,
  getAdminEmailDeliveryConfiguration: mocks.config,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/admin/emails",
  useSearchParams: () => new URLSearchParams(mocks.query),
  useSelectedLayoutSegment: () => "emails",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useTransition: () => [mocks.pending, (action: () => void) => action()],
}));
vi.mock("@/lib/admin/server", () => ({
  requirePlatformAdmin: mocks.admin,
  requirePlatformAdminRole: mocks.admin,
  PlatformAdminAuthorizationError: class extends Error {},
}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.user }));
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  mocks.pending = false;
  mocks.query = "";
  mocks.admin.mockResolvedValue({
    userId: "review",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  });
  mocks.user.mockResolvedValue({ email: "review-admin@example.test" });
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});
async function setup(state: (typeof emailStates)[number] = "healthy") {
  const fixture = emailFixture(state);
  mocks.list.mockResolvedValue(fixture.result);
  mocks.config.mockReturnValue(fixture.delivery);
  mocks.query = new URLSearchParams(fixture.params).toString();
  const element = await Page({ searchParams: Promise.resolve(fixture.params) });
  return { ...fixture, element };
}
describe("Email Operations presentation", () => {
  it("labels development adapter records without treating outbox totals as external sends", async () => {
    const fixture = emailFixture("healthy");
    fixture.result.items[0]!.development_adapter = true;
    mocks.list.mockResolvedValue(fixture.result);
    mocks.config.mockReturnValue(fixture.delivery);
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByText("Development adapter — no external email sent"),
    ).toBeVisible();
    expect(screen.getByText(/not externally sent or delivered totals/)).toBeVisible();
    expect(screen.getByText("Outbox: Healthy")).toBeVisible();
  });
  it.each(["healthy", "attention", "backlog", "active", "empty", "stress"] as const)(
    "preserves authoritative evidence for %s",
    async (state) => {
      const fixture = await setup(state);
      const { container } = render(fixture.element);
      expect(mocks.list).toHaveBeenCalledExactlyOnceWith(
        parseAdminEmailParams(fixture.params),
      );
      expect(mocks.config).toHaveBeenCalledTimes(1);
      expect(screen.getByText(fixture.delivery.label)).toBeInTheDocument();
      expect(screen.getByText(fixture.delivery.description)).toBeInTheDocument();
      expect(
        screen.getByText(getAdminEmailHealth(fixture.result.summary).description),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/not confirmed delivery, opening, or reading/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Refresh outbox|Retry|Resend/ }),
      ).not.toBeInTheDocument();
      for (const [status, value] of Object.entries({
        PENDING: fixture.result.summary.pending,
        SENDING: fixture.result.summary.sending,
        SENT: fixture.result.summary.sent,
        FAILED: fixture.result.summary.failed,
      })) {
        expect(
          container.querySelector(`[data-admin-email-status="${status}"] dd`),
        ).toHaveTextContent(value.toLocaleString("en"));
      }
      const rows = container.querySelectorAll('[data-admin-directory="emails"] li');
      expect(rows).toHaveLength(fixture.result.items.length);
      fixture.result.items.forEach((event, index) => {
        expect(rows[index]).toHaveTextContent(event.booking.reference);
        expect(rows[index]).toHaveTextContent(event.booking.title);
        expect(rows[index]).toHaveTextContent(event.business.name);
        expect(rows[index].querySelector("a")).toHaveAttribute(
          "href",
          `/admin/emails/${event.id}`,
        );
        expect(rows[index].querySelector("time")).toHaveAttribute(
          "datetime",
          event.created_at,
        );
        expect(rows[index]).toHaveTextContent(
          `${event.attempt_count.toLocaleString("en")} ${event.attempt_count === 1 ? "attempt" : "attempts"}`,
        );
      });
      if (state === "empty")
        expect(screen.getByText("No email events found.")).toBeInTheDocument();
      if (state === "active") {
        const next = screen.getByRole("link", { name: "Next page" });
        const query = new URL(next.getAttribute("href")!, "https://example.test")
          .searchParams;
        expect(query.get("page")).toBe("3");
        expect(query.get("q")).toBe("review");
        expect(query.get("status")).toBe("FAILED");
        expect(query.get("range")).toBe("30d");
        expect(
          screen.getByRole("link", { name: "Clear context filter" }),
        ).toHaveAttribute("href", "/admin/emails");
      }
    },
  );
  it("retains search submission, clearing, filter parameters, and page reset", async () => {
    const fixture = await setup("active");
    render(fixture.element);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "MC-reference" } });
    fireEvent.submit(screen.getByRole("search"));
    let query = new URL(mocks.replace.mock.calls.at(-1)![0], "https://example.test")
      .searchParams;
    expect(query.get("q")).toBe("MC-reference");
    expect(query.has("page")).toBe(false);
    expect(query.get("eventType")).toBe("BOOKING_DELIVERED");
    fireEvent.click(screen.getByRole("button", { name: "Clear email event search" }));
    query = new URL(mocks.replace.mock.calls.at(-1)![0], "https://example.test")
      .searchParams;
    expect(query.has("q")).toBe(false);
    expect(query.get("business")).toBe(fixture.params.business);
    // Use the real Radix keyboard interaction, not a replacement select implementation.
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Event status" }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: "Pending" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    query = new URL(mocks.replace.mock.calls.at(-1)![0], "https://example.test")
      .searchParams;
    expect(query.get("status")).toBe("PENDING");
    expect(query.has("page")).toBe(false);
    expect(query.get("range")).toBe("30d");
  });
  it("does not expose injected recipient, payload, or configuration secrets", async () => {
    const fixture = await setup();
    const sentinel = "PRIVATE_DO_NOT_RENDER";
    Object.assign(fixture.result.items[0], {
      recipient: sentinel,
      provider_payload: sentinel,
      raw_body: sentinel,
    });
    Object.assign(fixture.delivery, { api_key: sentinel });
    const { container } = render(await Page({}));
    expect(container.textContent).not.toContain(sentinel);
    expect(container.textContent).not.toContain(fixture.result.items[0].id);
  });
  it.each([
    ["Event status", "All", "status", null],
    ["Event type", "Booking Confirmed", "eventType", "BOOKING_CONFIRMED"],
    ["Date range", "Today", "range", "today"],
  ] as const)("preserves %s URL navigation", async (label, option, param, expected) => {
    const fixture = await setup("active");
    render(fixture.element);
    fireEvent.keyDown(screen.getByRole("combobox", { name: label }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: option }));
    const query = new URL(mocks.replace.mock.calls.at(-1)![0], "https://example.test")
      .searchParams;
    expect(query.get(param)).toBe(expected);
    expect(query.has("page")).toBe(false);
    expect(query.get("q")).toBe("review");
    expect(query.get("business")).toBe(fixture.params.business);
    expect(mocks.replace.mock.calls.at(-1)![1]).toEqual({ scroll: false });
  });
  it("preserves clickable status summaries and server type totals independently of page rows", async () => {
    const fixture = await setup("active");
    const { container } = render(fixture.element);
    const sent = container.querySelector('[data-admin-email-status="SENT"]')!;
    const query = new URL(sent.getAttribute("href")!, "https://example.test")
      .searchParams;
    expect(query.get("status")).toBe("SENT");
    expect(query.get("q")).toBe("review");
    expect(query.get("eventType")).toBe("BOOKING_DELIVERED");
    expect(query.has("page")).toBe(false);
    const totals = screen.getByRole("region", { name: "Event type totals" });
    expect(totals.querySelector("dd")).toHaveTextContent("60");
    expect(totals).toHaveTextContent("60 failed");
    expect(totals.querySelector("a,button")).toBeNull();
  });
  it("keeps source failures in the existing error boundary rather than fabricating health", async () => {
    await setup();
    mocks.list.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(Page({})).rejects.toThrow("Unavailable");
  });
  it("announces structural loading without interactive or fabricated evidence", () => {
    const { container } = render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Email Operations");
    expect(container.querySelectorAll("button,a")).toHaveLength(0);
  });
  it.skipIf(process.env.ADMIN_EMAIL_PREVIEW !== "1")(
    "generates isolated local review fixtures",
    async () => {
      const directory = path.resolve("../output/playwright/admin-email");
      fs.mkdirSync(directory, { recursive: true });
      for (const state of emailStates) {
        const fixture = await setup(state);
        mocks.pending = state === "searching";
        if (state === "stress")
          mocks.user.mockResolvedValue({
            email: "long-admin.".repeat(12) + "@example.test",
          });
        else mocks.user.mockResolvedValue({ email: "review-admin@example.test" });
        const { container } = render(
          await Layout({ children: state === "loading" ? <Loading /> : fixture.element }),
        );
        // Client controls are mounted in jsdom to resolve their selected display labels.
        fs.writeFileSync(
          path.join(directory, state + ".html"),
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOCAL SYNTHETIC EMAIL REVIEW — ${state}</title><link rel="stylesheet" href="/styles.css"></head><body>${container.innerHTML}</body></html>`,
        );
        cleanup();
      }
    },
  );
});
