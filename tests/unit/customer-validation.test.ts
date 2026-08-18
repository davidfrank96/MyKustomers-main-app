import { describe, expect, it } from "vitest";
import {
  customerFormSchema,
  parseCustomerListParams,
} from "@/features/customers/validation";

describe("customer validation", () => {
  it("accepts minimal customer details and normalizes email", () => {
    const parsed = customerFormSchema.safeParse({
      name: " Ada Buyer ",
      email: "ADA@EXAMPLE.COM",
      phone: "",
      notes: "Prefers WhatsApp.",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Ada Buyer");
      expect(parsed.data.email).toBe("ada@example.com");
      expect(parsed.data.phone).toBeUndefined();
    }
  });

  it("does not require email or phone", () => {
    const parsed = customerFormSchema.safeParse({
      name: "Walk-in customer",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email, phone, and oversized notes", () => {
    const parsed = customerFormSchema.safeParse({
      name: "Ada Buyer",
      email: "not-an-email",
      phone: "<script>",
      notes: "x".repeat(5001),
    });

    expect(parsed.success).toBe(false);
  });

  it("parses archive filters and clamps pagination", () => {
    expect(
      parseCustomerListParams({
        q: "Ada",
        status: "archived",
        page: "3",
        limit: "25",
      }),
    ).toEqual({
      q: "Ada",
      status: "archived",
      page: 3,
      limit: 25,
    });

    expect(
      parseCustomerListParams({
        q: "x".repeat(100),
        status: "unknown",
        page: "-2",
        limit: "100",
      }),
    ).toEqual({
      q: "x".repeat(80),
      status: "active",
      page: 1,
      limit: 10,
    });
  });
});
