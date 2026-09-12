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
import {
  getPublicFeedbackMetadata,
  getPublicFeedbackImageMetadata,
} from "@/features/feedback/social";
import {
  getPublicAmendmentMetadata,
  getPublicAmendmentImageMetadata,
} from "@/features/amendments/social";
import {
  getPublicAddonMetadata,
  getPublicAddonImageMetadata,
} from "@/features/addons/social";
import { getEventBusinessLogoPath } from "@/features/businesses/email-brand";
import {
  buildBusinessCapabilityMetadata,
  type CapabilityBrandKind,
} from "@/features/businesses/social-metadata";

const tokenA = "A".repeat(43),
  tokenB = "B".repeat(43);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const businessA = "20000000-0000-4000-8000-000000000001",
  businessB = "20000000-0000-4000-8000-000000000002";
const previewA = "40000000-0000-4000-8000-000000000001",
  previewB = "40000000-0000-4000-8000-000000000002";
const cases = [
  {
    kind: "feedback",
    table: "feedback_links",
    lookup: getPublicFeedbackMetadata,
    image: getPublicFeedbackImageMetadata,
    status: "DELIVERED",
    purpose: "booking_feedback",
  },
  {
    kind: "amendment",
    table: "booking_amendments",
    lookup: getPublicAmendmentMetadata,
    image: getPublicAmendmentImageMetadata,
    status: "IN_PROGRESS",
    purpose: null,
  },
  {
    kind: "addon",
    table: "booking_addon_confirmation_links",
    lookup: getPublicAddonMetadata,
    image: getPublicAddonImageMetadata,
    status: "IN_PROGRESS",
    purpose: "booking_addon_confirmation",
  },
] as const;

for (const c of cases)
  describe(`${c.kind} brand projection`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
      state.configured = true;
      state.reads = [];
      state.rows = {
        [c.table]: [
          {
            id: previewA,
            token_hash: hash(tokenA),
            business_id: businessA,
            booking_id: "booking-a",
            booking_addon_id: "addon-a",
            expires_at: "2099-01-01",
            used_at: null,
            revoked_at: null,
            purpose: c.purpose,
            status: "PENDING_CUSTOMER",
            base_terms_hash: "terms",
          },
          {
            id: previewB,
            token_hash: hash(tokenB),
            business_id: businessB,
            booking_id: "booking-b",
            booking_addon_id: "addon-b",
            expires_at: "2099-01-01",
            used_at: null,
            revoked_at: null,
            purpose: c.purpose,
            status: "PENDING_CUSTOMER",
            base_terms_hash: "terms",
          },
        ],
        bookings: [
          {
            id: "booking-a",
            business_id: businessA,
            status: c.status,
            confirmation_terms_hash: "terms",
            description: "Private booking",
            feedback: "Private feedback",
            total: 591234,
            email: "private@example.invalid",
          },
          {
            id: "booking-b",
            business_id: businessB,
            status: c.status,
            confirmation_terms_hash: "terms",
          },
        ],
        booking_addons: [
          {
            id: "addon-a",
            booking_id: "booking-a",
            business_id: businessA,
            status: "AWAITING_CUSTOMER",
          },
          {
            id: "addon-b",
            booking_id: "booking-b",
            business_id: businessB,
            status: "AWAITING_CUSTOMER",
          },
        ],
        businesses: [
          { id: businessA, name: "Cedar Studio", logo_path: `${businessA}/logo.webp` },
          { id: businessB, name: "Birch Workshop", logo_path: `${businessB}/logo.webp` },
        ],
      };
    });
    it("resolves A/B from the exact capability and exposes only identity without RPC writes", async () => {
      for (const [token, id, businessId, name] of [
        [tokenA, previewA, businessA, "Cedar Studio"],
        [tokenB, previewB, businessB, "Birch Workshop"],
      ]) {
        const identity = await c.lookup(token);
        expect(identity).toEqual({
          previewId: id,
          businessName: name,
          businessLogoPath: `${businessId}/logo.webp`,
        });
        expect(await c.image(id)).toEqual(identity);
        const result = JSON.stringify(
          buildBusinessCapabilityMetadata(c.kind as CapabilityBrandKind, identity!),
        );
        expect(result).toContain(`/social/${c.kind}/${id}`);
        expect(result).not.toMatch(
          /Private booking|Private feedback|591234|private@example.invalid|token_hash|terms_hash/,
        );
        expect(result).not.toContain(token);
        expect(result).not.toContain(hash(token));
      }
      expect(state.rpc).not.toHaveBeenCalled();
      expect(state.consume).not.toHaveBeenCalled();
      expect(
        state.reads.every(
          (r) => !r.columns.includes("*") && !r.columns.includes("customer"),
        ),
      ).toBe(true);
    });
    it.each(["invalid", tokenA, hash(tokenA), businessA.replace("4000", "1000")])(
      "rejects invalid image IDs %s",
      async (id) => {
        expect(await c.image(id)).toBeNull();
        expect(state.reads).toEqual([]);
      },
    );
    it("rejects expired/revoked/mismatched records and missing configuration", async () => {
      const link = state.rows[c.table][0];
      link.expires_at = "2000-01-01";
      expect(await c.lookup(tokenA)).toBeNull();
      link.expires_at = "2099-01-01";
      link.revoked_at = "2026-01-01";
      link.status = "REVOKED";
      expect(await c.image(previewA)).toBeNull();
      link.revoked_at = null;
      link.status = "PENDING_CUSTOMER";
      link.business_id = businessB;
      expect(await c.lookup(tokenA)).toBeNull();
      state.configured = false;
      expect(await c.lookup(tokenA)).toBeNull();
    });
    it("retains vendor initials when no valid owned logo exists", async () => {
      for (const path of [
        null,
        `${businessB}/logo.webp`,
        "https://evil.test/logo.webp",
      ]) {
        state.rows.businesses[0].logo_path = path;
        expect(await c.lookup(tokenA)).toMatchObject({
          businessName: "Cedar Studio",
          businessLogoPath: null,
        });
        expect(await getEventBusinessLogoPath(businessA)).toBeNull();
      }
    });
    it("preserves used-link identity without exposing submission or decision state", async () => {
      const link = state.rows[c.table][0];
      link.used_at = "2026-01-01";
      link.status = "CONFIRMED";
      link.expires_at = "2000-01-01";
      state.rows.booking_addons[0].status = "CONFIRMED";
      const identity = await c.image(previewA);
      expect(identity?.businessName).toBe("Cedar Studio");
      expect(
        JSON.stringify(buildBusinessCapabilityMetadata(c.kind, identity!)),
      ).not.toMatch(/already|submitted|used_at|confirmed_at/);
    });
    it("does not cross-brand an event when another business is selected elsewhere", async () => {
      expect(await getEventBusinessLogoPath(businessA)).toBe(`${businessA}/logo.webp`);
      expect(await getEventBusinessLogoPath(businessB)).toBe(`${businessB}/logo.webp`);
    });
    it("rejects wrong purpose or stale amendment terms", async () => {
      if (c.kind === "amendment")
        state.rows.bookings[0].confirmation_terms_hash = "new-terms";
      else state.rows[c.table][0].purpose = "another-purpose";
      expect(await c.lookup(tokenA)).toBeNull();
    });
  });
