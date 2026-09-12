import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  configured: true,
  rows: {} as Record<string, Record<string, unknown>[]>,
  reads: [] as { table: string; columns: string; filters: Record<string, unknown> }[],

  consume: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/features/confirmation-links/rate-limit", () => ({
  consumeConfirmationRateLimit: state.consume,
}));
vi.mock("@/lib/supabase/admin", () => ({
  canUseServiceRoleClient: () => state.configured,
  createServiceRoleClient: () => ({
    rpc: state.rpc,
    from(table: string) {
      const read = { table, columns: "", filters: {} as Record<string, unknown> };
      const query = {
        select(columns: string) {
          read.columns = columns;
          return query;
        },
        eq(key: string, value: unknown) {
          read.filters[key] = value;
          return query;
        },
        abortSignal() {
          return query;
        },
        async maybeSingle() {
          state.reads.push(read);
          const row = (state.rows[table] ?? []).find((candidate) =>
            Object.entries(read.filters).every(
              ([key, value]) => candidate[key] === value,
            ),
          );
          return { data: row ?? null, error: null };
        },
      };
      return query;
    },
  }),
}));
import { deliverClaimedEmailEvent } from "@/lib/email/outbox";
import type { TransactionalEmailMessage } from "@/lib/email/types";

const businessA = "20000000-0000-4000-8000-000000000001",
  businessB = "20000000-0000-4000-8000-000000000002";
const events = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
];
const attempts = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
];
beforeEach(() => {
  vi.clearAllMocks();
  state.configured = true;
  state.reads = [];
  state.rpc.mockResolvedValue({ data: true, error: null });
  state.rows = {
    businesses: [
      { id: businessA, name: "Cedar Studio", logo_path: `${businessA}/logo.webp` },
      { id: businessB, name: "Birch Workshop", logo_path: `${businessB}/logo.webp` },
    ],
    email_events: [],
    email_delivery_attempts: [],
    confirmation_links: [],
    bookings: [],
  };
  for (const [i, business_id] of [businessA, businessB].entries()) {
    state.rows.email_events.push({
      id: events[i],
      business_id,
      booking_id: `booking-${i}`,
      confirmation_link_id: `link-${i}`,
      status: "SENDING",
      event_type: "BOOKING_CONFIRMATION_REQUESTED",
      attempt_count: 1,
      recipient_email: `recipient-${i}@example.invalid`,
    });
    state.rows.email_delivery_attempts.push({
      id: attempts[i],
      email_event_id: events[i],
      attempt_number: 1,
      provider: "brevo",
      status: "SENDING",
    });
    state.rows.confirmation_links.push({
      id: `link-${i}`,
      booking_id: `booking-${i}`,
      business_id,
      used_at: null,
      revoked_at: null,
      expires_at: "2099-01-01",
    });
    state.rows.bookings.push({
      id: `booking-${i}`,
      business_id,
      title: "Controlled booking",
      reference: `BK-00${i}`,
      scheduled_for: null,
    });
  }
});

describe("event-owned logo dispatch", () => {
  it("renders A/B logos from claimed events while preserving recipients, attempts and provider correlation", async () => {
    const sent: TransactionalEmailMessage[] = [];
    const provider = {
      name: "brevo" as const,
      send: vi.fn(async (message: TransactionalEmailMessage) => {
        sent.push(message);
        return { status: "sent" as const, messageId: "test-provider-id" };
      }),
    };
    for (const i of [0, 1]) {
      expect(
        await deliverClaimedEmailEvent({
          emailEventId: events[i],
          attemptId: attempts[i],
          provider,
          context: { confirmationUrl: "https://mykustomers.com/c/controlled" },
        }),
      ).toEqual({ status: "sent" });
      const own = i === 0 ? businessA : businessB,
        other = i === 0 ? businessB : businessA;
      expect(sent[i].html).toContain(`/brand/business/${own}/logo.png`);
      expect(sent[i].html).not.toContain(other);
      expect(sent[i].to).toBe(`recipient-${i}@example.invalid`);
      expect(sent[i].headers?.["X-Mailin-custom"]).toMatch(
        /^mk-attempt-v1:[a-f0-9]{64}$/,
      );
      expect(state.rpc).toHaveBeenCalledWith(
        "finalize_email_delivery_attempt",
        expect.objectContaining({
          p_email_event_id: events[i],
          p_attempt_id: attempts[i],
          p_result: "SENT",
        }),
      );
    }
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(
      state.reads
        .filter((r) => r.table === "businesses" && r.columns === "logo_path")
        .map((r) => r.filters.id),
    ).toEqual([businessA, businessB]);
  });
  it("falls back to initials if the event business has no valid owned logo", async () => {
    state.rows.businesses[0].logo_path = `${businessB}/logo.webp`;
    const send = vi.fn(async (message: TransactionalEmailMessage) => {
      expect(message.html).toContain('class="vendor-initial"');
      expect(message.html).not.toContain('class="vendor-logo"');
      return { status: "sent" as const, messageId: "test-provider-id" };
    });
    expect(
      await deliverClaimedEmailEvent({
        emailEventId: events[0],
        attemptId: attempts[0],
        provider: { name: "brevo" as const, send },
        context: { confirmationUrl: "https://mykustomers.com/c/controlled" },
      }),
    ).toEqual({ status: "sent" });
    expect(send).toHaveBeenCalledOnce();
  });
});
