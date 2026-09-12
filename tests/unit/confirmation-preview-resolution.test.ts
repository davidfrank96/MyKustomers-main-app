import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  reads: [] as { table: string; columns: string; filters: Record<string, unknown> }[],
  configured: true,
  consume: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/features/confirmation-links/rate-limit", () => ({
  consumeConfirmationRateLimit: state.consume,
}));
vi.mock("@/lib/email/outbox", () => ({ deliverEmailEvent: vi.fn() }));
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
import {
  getPublicConfirmationMetadata,
  getPublicConfirmationImageMetadata,
} from "@/features/confirmation-links/public";
import { buildPublicConfirmationMetadata } from "@/features/confirmation-links/metadata";
import { handlePublicCapabilityOpen } from "@/features/confirmation-links/open-route";

const tokenA = "A".repeat(43);
const tokenB = "B".repeat(43);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const businessA = "11111111-1111-4111-8111-111111111111";
const businessB = "22222222-2222-4222-8222-222222222222";
const previewA = "33333333-3333-4333-8333-333333333333";
const previewB = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  state.configured = true;
  state.reads = [];
  state.rows = {
    confirmation_links: [
      {
        id: previewA,
        token_hash: hash(tokenA),
        business_id: businessA,
        booking_id: "booking-a",
        expires_at: "2099-01-01T00:00:00Z",
        revoked_at: null,
        used_at: null,
      },
      {
        id: previewB,
        token_hash: hash(tokenB),
        business_id: businessB,
        booking_id: "booking-b",
        expires_at: "2099-01-01T00:00:00Z",
        revoked_at: null,
        used_at: null,
      },
    ],
    bookings: [
      {
        id: "booking-a",
        business_id: businessA,
        status: "AWAITING_CUSTOMER",
        customer_name: "Private Customer",
        customer_email: "private@example.invalid",
        customer_phone: "+2340000000",
        description: "Private booking",
        total: 50000,
        notes: "Private note",
        feedback: "Private feedback",
      },
      { id: "booking-b", business_id: businessB, status: "AWAITING_CUSTOMER" },
    ],
    businesses: [
      { id: businessA, name: "Cedar Workshop", logo_path: `${businessA}/logo.webp` },
      { id: businessB, name: "Birch Studio", logo_path: `${businessB}/logo.webp` },
    ],
  };
});

describe("confirmation preview resolution", () => {
  it("binds both anonymous metadata and image lookup to the same booking business", async () => {
    for (const [token, previewId, businessId, name] of [
      [tokenA, previewA, businessA, "Cedar Workshop"],
      [tokenB, previewB, businessB, "Birch Studio"],
    ]) {
      const metadata = await getPublicConfirmationMetadata(token);
      expect(metadata).toEqual({
        previewId,
        businessName: name,
        businessLogoPath: `${businessId}/logo.webp`,
      });
      expect(await getPublicConfirmationImageMetadata(previewId)).toEqual(metadata);
    }
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.consume).not.toHaveBeenCalled();
    expect(
      state.reads
        .filter((read) => read.table === "bookings")
        .every((read) => read.columns === "status" && Boolean(read.filters.business_id)),
    ).toBe(true);
  });

  it("does not project customer data, raw tokens or stored hashes into metadata", async () => {
    const identity = await getPublicConfirmationMetadata(tokenA);
    const metadata = buildPublicConfirmationMetadata(identity!);
    const serialized = JSON.stringify(metadata);
    for (const value of [
      tokenA,
      hash(tokenA),
      "Private Customer",
      "private@example.invalid",
      "+2340000000",
      "Private booking",
      "50000",
      "Private note",
      "Private feedback",
    ]) {
      expect(serialized).not.toContain(value);
    }
    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: `https://mykustomers.com/social/confirmation/${previewA}`,
          type: "image/png",
          width: 1200,
          height: 630,
          alt: "Cedar Workshop business logo",
        },
      ],
    });
  });

  it("rejects a confirmation record whose booking belongs to another business", async () => {
    state.rows.confirmation_links[0].booking_id = "booking-b";
    expect(await getPublicConfirmationMetadata(tokenA)).toBeNull();
    expect(await getPublicConfirmationImageMetadata(previewA)).toBeNull();
  });

  it("does not use a logo path belonging to another business", async () => {
    state.rows.businesses[0].logo_path = `${businessB}/logo.webp`;
    expect(await getPublicConfirmationMetadata(tokenA)).toMatchObject({
      businessName: "Cedar Workshop",
      businessLogoPath: null,
    });
  });

  it.each(["revoked", "expired", "wrong-status", "missing"])(
    "returns no identity for a %s capability or image",
    async (scenario) => {
      if (scenario === "revoked")
        state.rows.confirmation_links[0].revoked_at = "2026-01-01T00:00:00Z";
      if (scenario === "expired")
        state.rows.confirmation_links[0].expires_at = "2020-01-01T00:00:00Z";
      if (scenario === "wrong-status") state.rows.bookings[0].status = "DRAFT";
      if (scenario === "missing") state.rows.confirmation_links = [];
      expect(await getPublicConfirmationMetadata(tokenA)).toBeNull();
      expect(await getPublicConfirmationImageMetadata(previewA)).toBeNull();
    },
  );

  it("preserves the current already-used link identity policy", async () => {
    Object.assign(state.rows.confirmation_links[0], {
      used_at: "2026-01-01T00:00:00Z",
      expires_at: "2020-01-01T00:00:00Z",
    });
    state.rows.bookings[0].status = "CONFIRMED";
    expect(await getPublicConfirmationImageMetadata(previewA)).toMatchObject({
      businessName: "Cedar Workshop",
    });
  });

  it("fails closed before data access for malformed IDs, raw capabilities or missing config", async () => {
    expect(await getPublicConfirmationImageMetadata(tokenA)).toBeNull();
    expect(await getPublicConfirmationImageMetadata(hash(tokenA))).toBeNull();
    expect(await getPublicConfirmationMetadata("invalid")).toBeNull();
    state.configured = false;
    expect(await getPublicConfirmationImageMetadata(previewA)).toBeNull();
    expect(state.reads).toEqual([]);
  });
});

describe("social crawler open attribution", () => {
  it.each([
    "WhatsApp/2.24 Android",
    "WhatsApp/2.24 iOS",
    "facebookexternalhit/1.1",
    "Applebot/0.1",
    "iMessage",
    "Twitterbot/1.0",
  ])("%s cannot create customer-open evidence", async (userAgent) => {
    const record = vi.fn();
    const response = await handlePublicCapabilityOpen(
      new Request("https://mykustomers.com/api/confirmation/open", {
        method: "POST",
        headers: { "user-agent": userAgent },
        body: JSON.stringify({ token: tokenA }),
      }),
      record,
    );
    expect(response.status).toBe(204);
    expect(record).not.toHaveBeenCalled();
  });

  it("keeps ordinary browser open evidence on its existing path", async () => {
    const record = vi.fn();
    await handlePublicCapabilityOpen(
      new Request("https://mykustomers.com/api/confirmation/open", {
        method: "POST",
        headers: { "user-agent": "Mozilla/5.0 AppleWebKit Safari" },
        body: JSON.stringify({ token: tokenA }),
      }),
      record,
    );
    expect(record).toHaveBeenCalledExactlyOnceWith(tokenA);
  });
});
