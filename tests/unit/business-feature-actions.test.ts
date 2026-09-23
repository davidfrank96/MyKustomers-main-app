// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("@/lib/admin/server", () => ({
  requirePrivilegedPlatformAdmin: mocks.admin,
  PrivilegedPlatformAdminAuthorizationError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
import { PrivilegedPlatformAdminAuthorizationError } from "@/lib/admin/server";
import { setWhatsAppBusinessFeature } from "@/features/business-features/actions";
const business = "10000000-0000-4000-8000-000000000001";
function form(reason = "Controlled fixture change") {
  const value = new FormData();
  value.set("reason", reason);
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
it.each(["MFA_REQUIRED", "NOT_AUTHORIZED"] as const)(
  "denies %s before database access",
  async (code) => {
    mocks.admin.mockRejectedValue(new PrivilegedPlatformAdminAuthorizationError(code));
    expect(
      await setWhatsAppBusinessFeature(
        business,
        true,
        { status: "idle", message: null },
        form(),
      ),
    ).toMatchObject({ status: code === "MFA_REQUIRED" ? "mfa_required" : "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it("requires a reason and a valid target", async () => {
  expect(
    await setWhatsAppBusinessFeature(
      business,
      true,
      { status: "idle", message: null },
      form(" "),
    ),
  ).toMatchObject({ status: "error" });
  expect(
    await setWhatsAppBusinessFeature(
      "bad",
      true,
      { status: "idle", message: null },
      form(),
    ),
  ).toMatchObject({ status: "error" });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([true, false])(
  "uses the authenticated, audited RPC for enabled=%s",
  async (enabled) => {
    expect(
      await setWhatsAppBusinessFeature(
        business,
        enabled,
        { status: "idle", message: null },
        form(),
      ),
    ).toMatchObject({ status: "success" });
    expect(mocks.admin).toHaveBeenCalledWith(["SUPER_ADMIN"]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "set_business_feature_entitlement",
      {
        p_business_id: business,
        p_feature_key: "WHATSAPP_CUSTOMER_UPDATES",
        p_enabled: enabled,
        p_reason: "Controlled fixture change",
      },
    );
  },
);
it("never reports a failed database mutation as success", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
  expect(
    await setWhatsAppBusinessFeature(
      business,
      true,
      { status: "idle", message: null },
      form(),
    ),
  ).toMatchObject({ status: "error" });
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
