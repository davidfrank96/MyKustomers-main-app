import { describe, expect, it } from "vitest";
import { normalizeCustomerContactEmail } from "@/features/customers/email";
import { customerEmailSchema } from "@/features/customers/validation";

describe("customer contact email normalization", () => {
  it.each([
    ["David.Frank@HOTMAIL.COM", "David.Frank@hotmail.com"],
    ["david+Cake@Example.IE", "david+Cake@example.ie"],
    ["Jane.Doe@Company.CO.UK", "Jane.Doe@company.co.uk"],
    ["  David@HOTMAIL.COM  ", "David@hotmail.com"],
  ])("preserves the local part in %s", (input, expected) => {
    expect(normalizeCustomerContactEmail(input)).toBe(expected);
    expect(customerEmailSchema.parse(input)).toBe(expected);
  });

  it.each([
    "customer@gmail.com",
    "customer@hotmail.com",
    "customer@outlook.com",
    "customer@yahoo.com",
    "customer@icloud.com",
    "customer@example.ie",
    "customer@example.co.uk",
    "customer+booking@example.com",
    "customer@orders.example.com",
    "customer@company.africa",
  ])("accepts a legitimate arbitrary domain: %s", (email) => {
    expect(customerEmailSchema.parse(email)).toBe(email);
  });

  it.each(["missing-at.example.com", "missing-domain@", "space @example.com"])(
    "rejects malformed input: %s",
    (email) => {
      expect(customerEmailSchema.safeParse(email).success).toBe(false);
    },
  );
});
