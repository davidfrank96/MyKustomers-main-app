// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  limit: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  rpc: vi.fn(),
  selectBusiness: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/config/public-env", () => ({ isSupabasePublicEnvConfigured: () => true }));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeApplicationRateLimit: mocks.limit,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }),
}));
vi.mock("@/lib/auth/current-business", () => ({
  setSelectedBusinessId: mocks.selectBusiness,
}));
import { boundedJson, notificationAuth } from "@/features/notifications/http";
import { disconnectNotificationDevice } from "@/features/notifications/logout";
import { GET as resolveNotification } from "@/app/notifications/open/[notificationId]/route";
const id = "11111111-1111-4111-8111-111111111111";
const biz = "22222222-2222-4222-8222-222222222222";
function chain(data: unknown) {
  const result = { data, error: null };
  const q: Record<string, unknown> = {
    then: (r: (v: unknown) => unknown) => Promise.resolve(result).then(r),
  };
  for (const method of ["select", "eq", "is", "update", "maybeSingle"])
    q[method] = vi.fn(() => q);
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  });
  mocks.limit.mockResolvedValue({ status: "allowed" });
});
describe("notification request boundaries", () => {
  it("rejects cross-origin mutations before reading credentials or body", async () => {
    await expect(
      notificationAuth(
        new Request("https://mykustomers.com/api/notifications/read", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("requires a fresh verified user and rate limits its identity", async () => {
    const req = new Request("https://mykustomers.com/api/notifications/read", {
      headers: { origin: "https://mykustomers.com" },
    });
    await notificationAuth(req);
    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(
      expect.objectContaining({ keyParts: ["owner"] }),
    );
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(notificationAuth(req)).rejects.toMatchObject({ status: 401 });
  });
  it("bounds actual streamed bytes when content-length is absent", async () => {
    const request = new Request("https://mykustomers.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "x".repeat(9000) }),
    });
    await expect(boundedJson(request)).rejects.toMatchObject({ status: 413 });
    await expect(
      boundedJson(new Request("https://mykustomers.com", { method: "POST", body: "{}" })),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("cleans up only the cookie-bound device and retains the cookie on failure", async () => {
    mocks.cookieGet.mockReturnValue({ value: id });
    mocks.rpc.mockResolvedValue({ error: { code: "503" } });
    expect(await disconnectNotificationDevice()).toBe(false);
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ error: null });
    expect(await disconnectNotificationDevice()).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("remove_push_subscription", {
      p_subscription_id: id,
    });
    expect(mocks.cookieDelete).toHaveBeenCalled();
  });
  it("preserves the resolver through login without selecting any business", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await resolveNotification(
      new Request(`https://mykustomers.com/notifications/open/${id}`),
      { params: Promise.resolve({ notificationId: id }) },
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(`/notifications/open/${id}`);
    expect(mocks.selectBusiness).not.toHaveBeenCalled();
  });
  it("selects the notification's business and real feedback anchor after RLS booking checks", async () => {
    mocks.from.mockImplementation((table) =>
      chain(
        table === "notifications"
          ? {
              id,
              business_id: biz,
              booking_id: id,
              notification_type: "CUSTOMER_FEEDBACK_RECEIVED",
              read_at: "2026-09-12T00:00:00Z",
            }
          : { id },
      ),
    );
    const response = await resolveNotification(
      new Request(`https://mykustomers.com/notifications/open/${id}`),
      { params: Promise.resolve({ notificationId: id }) },
    );
    expect(mocks.selectBusiness).toHaveBeenCalledWith(biz);
    expect(response.headers.get("location")).toBe(
      `https://mykustomers.com/bookings/${id}#private-feedback`,
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not restore revoked or missing notification authority", async () => {
    mocks.from.mockReturnValue(chain(null));
    const response = await resolveNotification(
      new Request(`https://mykustomers.com/notifications/open/${id}`),
      { params: Promise.resolve({ notificationId: id }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.selectBusiness).not.toHaveBeenCalled();
  });
});

it("accepts the browser host when Next uses an internal listener URL", async () => {
  const request = new Request("http://localhost:3418/api/notifications/read", {
    headers: { host: "127.0.0.1:3418", origin: "http://127.0.0.1:3418" },
  });
  await expect(notificationAuth(request)).resolves.toMatchObject({
    user: { id: "owner" },
  });
});
