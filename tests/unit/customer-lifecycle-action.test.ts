import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentBusiness: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  requireCurrentBusiness: mocks.requireCurrentBusiness,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/features/customers/queries", () => ({
  hasPossibleDuplicateCustomer: vi.fn(),
}));

import { deleteCustomerAction } from "@/features/customers/actions";
import { initialCustomerActionState } from "@/features/customers/action-state";

const customerId = "00000000-0000-4000-8000-000000000001";

function customerLookup(data: { id: string } | null, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  return query;
}

function formData() {
  return new FormData();
}

describe("deleteCustomerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentBusiness.mockResolvedValue({
      user: { id: "user-1" },
      business: { id: "business-1" },
    });
  });

  it("fails closed before the RPC when the customer is outside the current business", async () => {
    const rpc = vi.fn();
    const lookup = customerLookup(null);
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => lookup), rpc });

    await expect(
      deleteCustomerAction(customerId, initialCustomerActionState, formData()),
    ).resolves.toEqual({
      status: "error",
      message: "The customer could not be deleted.",
    });
    expect(lookup.eq).toHaveBeenNthCalledWith(2, "business_id", "business-1");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps booking-history denial without deleting or revalidating", async () => {
    const lookup = customerLookup({ id: customerId });
    const rpc = vi.fn(async () => ({
      data: [{ deleted: false, reason: "booking_history_exists" }],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => lookup), rpc });

    const result = await deleteCustomerAction(
      customerId,
      initialCustomerActionState,
      formData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("booking history");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an authoritative eligible deletion and revalidates customer totals", async () => {
    const lookup = customerLookup({ id: customerId });
    const rpc = vi.fn(async () => ({
      data: [{ deleted: true, reason: "deleted" }],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => lookup), rpc });

    await expect(
      deleteCustomerAction(customerId, initialCustomerActionState, formData()),
    ).resolves.toEqual({
      status: "success",
      message: "Customer permanently deleted.",
    });
    expect(rpc).toHaveBeenCalledWith("delete_customer_if_eligible", {
      p_customer_id: customerId,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/customers");
  });
});
