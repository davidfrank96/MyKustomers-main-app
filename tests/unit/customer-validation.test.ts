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
      expect(parsed.data.email).toBe("ADA@example.com");
      expect(parsed.data.phone).toBeUndefined();
    }
  });

  it("does not require email or phone", () => {
    const parsed = customerFormSchema.safeParse({
      name: "Walk-in customer",
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    { name: "Name only", input: { name: "Walk-in customer" } },
    {
      name: "Name and email",
      input: { name: "Email customer", email: "email@example.com" },
    },
    {
      name: "Name and phone",
      input: { name: "Phone customer", phone: "+234 800 000 0000" },
    },
    {
      name: "All fields",
      input: {
        name: "Complete customer",
        email: "complete@example.com",
        phone: "+353 1 555 0100",
        notes: "Complete contact record.",
      },
    },
  ])("accepts $name", ({ input }) => {
    expect(customerFormSchema.safeParse(input).success).toBe(true);
  });

  it("keeps the customer name required", () => {
    const parsed = customerFormSchema.safeParse({
      name: "   ",
      email: "optional@example.com",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.name).toContain(
        "Customer name is required.",
      );
    }
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
      page: 1,
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
      limit: 25,
    });
  });
});
