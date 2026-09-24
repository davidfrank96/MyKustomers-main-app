import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), disable: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mocks.from }),
}));
vi.mock("@/features/whatsapp/access", () => ({ getWhatsAppAccess: mocks.access }));
vi.mock("@/features/whatsapp/actions", () => ({ disableBookingWhatsApp: mocks.disable }));
import { BookingUpdates } from "@/components/whatsapp/booking-updates";
let preference: {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  disabled_at: string | null;
} | null;
let events: { status: string }[];
let error: { message: string } | null;
beforeEach(() => {
  vi.clearAllMocks();
  preference = { email_enabled: true, whatsapp_enabled: false, disabled_at: null };
  events = [];
  error = null;
  mocks.access.mockResolvedValue({ entitled: true, available: true });
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: preference, error })),
      limit: vi.fn(async () => ({
        data: table === "whatsapp_events" ? events : [],
        error,
      })),
    };
    return chain;
  });
});
afterEach(cleanup);
async function show() {
  render(await BookingUpdates({ businessId: "business", bookingId: "booking" }));
}
it.each([
  [true, false, null, "Selected", "Not selected"],
  [true, true, null, "Selected", "Selected"],
  [false, true, null, "Not selected", "Selected"],
  // Neither is legitimate after stopping WhatsApp-only updates, not at creation.
  [false, false, "2026-09-24T00:00:00Z", "Not selected", "Updates stopped"],
] as const)(
  "preserves authoritative preference state %s / %s / %s",
  async (email, whatsapp, stopped, emailLabel, whatsappLabel) => {
    preference = {
      email_enabled: email,
      whatsapp_enabled: whatsapp,
      disabled_at: stopped,
    };
    await show();
    const section = screen.getByRole("region", { name: "Customer updates" });
    expect(
      within(section)
        .getAllByRole("definition")
        .map((node) => node.textContent),
    ).toEqual([emailLabel, whatsappLabel]);
    expect(within(section).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(section).queryByRole("link")).not.toBeInTheDocument();
    expect(within(section).queryAllByRole("button")).toHaveLength(whatsapp ? 1 : 0);
    expect(mocks.disable).not.toHaveBeenCalled();
  },
);
it("preserves paused access and historical uncertainty without claiming delivery", async () => {
  preference = { email_enabled: true, whatsapp_enabled: true, disabled_at: null };
  mocks.access.mockResolvedValue({ entitled: true, available: false });
  events = [{ status: "UNKNOWN" }];
  await show();
  expect(screen.getByText("Future updates paused")).toBeVisible();
  expect(screen.getByText("Delivery status uncertain")).toBeVisible();
  expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Stop WhatsApp updates" })).toBeVisible();
});
it("keeps the existing legacy default when preferences are absent", async () => {
  preference = null;
  await show();
  expect(screen.getAllByRole("definition").map((node) => node.textContent)).toEqual([
    "Selected",
    "Not selected",
  ]);
});
it("keeps the established unavailable fallback on a failed read", async () => {
  error = { message: "PRIVATE_ERROR" };
  await show();
  expect(
    screen.getByText("Customer update status is temporarily unavailable."),
  ).toBeVisible();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.queryByText("PRIVATE_ERROR")).not.toBeInTheDocument();
});
it("keeps the hidden summary when access and historical data are absent", async () => {
  mocks.access.mockResolvedValue({ entitled: false, available: false });
  preference = null;
  await show();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("preserves historical data after entitlement is removed and unknown-event fallback", async () => {
  mocks.access.mockResolvedValue({ entitled: false, available: false });
  events = [{ status: "UNRECOGNIZED" }];
  await show();
  expect(screen.getByRole("region", { name: "Customer updates" })).toBeVisible();
  expect(screen.getByText("Status unavailable")).toBeVisible();
});
