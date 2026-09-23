// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  rpc: vi.fn(),
  finish: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({ rpc: mocks.finish }),
}));
vi.mock("@/lib/whatsapp/control", () => ({
  getWhatsAppControl: () => ({ mutate: mocks.mutate }),
}));
import { changeWhatsAppSession } from "@/features/whatsapp/control-actions";
import { PrivilegedPlatformAdminAuthorizationError } from "@/lib/admin/server";
const initial = { status: "idle" as const, message: null };
const id = "50000000-0000-4000-8000-000000000001";
const form = (reason = "Controlled fixture operation") => {
  const f = new FormData();
  f.set("reason", reason);
  return f;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.rpc.mockResolvedValue({ data: id, error: null });
  mocks.mutate.mockResolvedValue(true);
  mocks.finish.mockResolvedValue({ data: true, error: null });
});
it.each(["MFA_REQUIRED", "NOT_AUTHORIZED"] as const)(
  "denies %s before any gateway/DB write",
  async (code) => {
    mocks.admin.mockRejectedValue(new PrivilegedPlatformAdminAuthorizationError(code));
    expect((await changeWhatsAppSession("replace", initial, form())).status).not.toBe(
      "success",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  },
);
it("requires a reason without contact details", async () => {
  for (const reason of ["", "+15555550123", "person@example.com"]) {
    expect((await changeWhatsAppSession("unlink", initial, form(reason))).status).toBe(
      "error",
    );
  }
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it("requires successful audited pause before handoff", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "private" } });
  expect((await changeWhatsAppSession("replace", initial, form())).status).toBe("error");
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it.each(["reconnect", "pair", "replace", "unlink", "resume"] as const)(
  "audits %s through fresh AAL2 and a server-only result",
  async (action) => {
    expect((await changeWhatsAppSession(action, initial, form())).status).toBe("success");
    expect(mocks.admin).toHaveBeenCalledWith(["SUPER_ADMIN"]);
    expect(mocks.rpc).toHaveBeenCalledWith("begin_whatsapp_control", {
      p_action: action,
      p_reason: "Controlled fixture operation",
    });
    expect(mocks.mutate).toHaveBeenCalledWith(action, id);
    expect(mocks.finish).toHaveBeenCalledWith("finish_whatsapp_control", {
      p_operation_id: id,
      p_succeeded: true,
    });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.mutate.mock.invocationCallOrder[0],
    );
  },
);
it("does not claim success after uncertain handoff or failed result audit", async () => {
  mocks.mutate.mockResolvedValue(false);
  expect((await changeWhatsAppSession("replace", initial, form())).status).toBe("error");
  expect(mocks.finish).toHaveBeenCalledWith("finish_whatsapp_control", {
    p_operation_id: id,
    p_succeeded: false,
  });
  mocks.mutate.mockResolvedValue(true);
  mocks.finish.mockResolvedValue({ data: false, error: null });
  expect((await changeWhatsAppSession("resume", initial, form())).status).toBe("error");
});
