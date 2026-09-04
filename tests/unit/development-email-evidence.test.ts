import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), available: vi.fn() }));
vi.mock("@/lib/admin/server", () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: mocks.client,
  canUseServiceRoleClient: mocks.available,
}));
import { findDevelopmentAdapterEvents } from "@/features/admin/development-email-evidence";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.available.mockReturnValue(true);
});
describe("bounded development adapter evidence", () => {
  it("denies unauthorized reads before accessing the service client", async () => {
    mocks.auth.mockRejectedValue(new Error("denied"));
    await expect(findDevelopmentAdapterEvents([id])).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([[], ["invalid"], Array(21).fill(id)])(
    "does not query for an empty or invalid batch",
    async (ids) => {
      expect(await findDevelopmentAdapterEvents(ids)).toEqual(new Set());
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );
  it("returns only authorized IDs, never provider IDs or recipients", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockResolvedValue({ data: [{ id }, { id: "unexpected" }], error: null }),
    };
    const from = vi.fn(() => query);
    mocks.client.mockReturnValue({ from });
    expect(await findDevelopmentAdapterEvents([id])).toEqual(new Set([id]));
    expect(from).toHaveBeenCalledWith("email_events");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.in).toHaveBeenCalledWith("id", [id]);
    expect(query.like).toHaveBeenCalledWith("provider_message_id", "development-%");
    expect(query.limit).toHaveBeenCalledWith(20);
  });
  it("does not disguise a failed lookup as external delivery", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: {} }),
    };
    mocks.client.mockReturnValue({ from: () => query });
    await expect(findDevelopmentAdapterEvents([id])).rejects.toThrow(
      "Email adapter evidence is unavailable.",
    );
  });
});
