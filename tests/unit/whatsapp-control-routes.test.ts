// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  role: vi.fn(),
  privileged: vi.fn(),
  status: vi.fn(),
  qr: vi.fn(),
}));
vi.mock("@/lib/admin/server", () => ({
  requirePlatformAdminRole: mocks.role,
  requirePrivilegedPlatformAdmin: mocks.privileged,
}));
vi.mock("@/lib/whatsapp/control", () => ({
  getWhatsAppControl: () => ({ status: mocks.status, qr: mocks.qr }),
}));
import { GET as status } from "@/app/api/admin/whatsapp/status/route";
import { GET as qr } from "@/app/api/admin/whatsapp/qr/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({});
  mocks.privileged.mockResolvedValue({});
  mocks.status.mockResolvedValue({ status: null, error: "Gateway unavailable" });
  mocks.qr.mockResolvedValue(null);
});
it("denies non-admin status before gateway access", async () => {
  mocks.role.mockRejectedValue(Error("denied"));
  expect((await status()).status).toBe(403);
  expect(mocks.status).not.toHaveBeenCalled();
});
it("QR requires fresh privileged Super Admin access and no-store", async () => {
  mocks.privileged.mockRejectedValue(Error("aal1"));
  const response = await qr();
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.privileged).toHaveBeenCalledWith(["SUPER_ADMIN"]);
  expect(mocks.qr).not.toHaveBeenCalled();
});
it("status reading does not repeatedly require MFA", async () => {
  const response = await status();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.role).toHaveBeenCalledWith(["SUPER_ADMIN"]);
  expect(mocks.privileged).not.toHaveBeenCalled();
});
it("connected/expired QR is unavailable without returning authentication data", async () => {
  const response = await qr();
  expect(response.status).toBe(409);
  expect(await response.text()).not.toContain("data:image");
});
