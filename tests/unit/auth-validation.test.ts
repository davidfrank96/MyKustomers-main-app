import { describe, expect, it } from "vitest";
import { signupSchema, loginSchema } from "@/features/auth/validation";

describe("auth validation", () => {
  it("accepts a strong signup payload", () => {
    const parsed = signupSchema.safeParse({
      displayName: "Ada Founder",
      email: "ADA@EXAMPLE.COM",
      password: "Securepass1",
      confirmPassword: "Securepass1",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("ada@example.com");
    }
  });

  it("rejects weak signup passwords", () => {
    const parsed = signupSchema.safeParse({
      displayName: "Ada Founder",
      email: "ada@example.com",
      password: "password",
      confirmPassword: "password",
    });

    expect(parsed.success).toBe(false);
  });

  it("requires login email and password", () => {
    const parsed = loginSchema.safeParse({
      email: "not-an-email",
      password: "",
    });

    expect(parsed.success).toBe(false);
  });
});
