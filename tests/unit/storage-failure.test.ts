import { describe, expect, it } from "vitest";
import { StorageFailure, storageFailureTags } from "@/lib/observability/storage-failure";
import { BusinessMembershipLookupError } from "@/lib/auth/business-access";
import { beforeSentrySend } from "@/lib/observability/sentry";

describe("bounded storage diagnostics", () => {
  it("preserves the actionable code through wrapping and Sentry minimization", () => {
    const raw = {
      code: "PGRST002",
      message: "private message",
      details: "private details",
    };
    const error = new BusinessMembershipLookupError(raw);
    expect(error.storageCode).toBe("PGRST002");
    expect(JSON.stringify(error)).not.toContain("private");
    expect(error.cause).toBeUndefined();
    expect(
      beforeSentrySend({ type: undefined, tags: storageFailureTags(error) })?.tags,
    ).toEqual({
      storage_code: "PGRST002",
    });
  });
  it.each([
    undefined,
    null,
    new Error("private provider error"),
    { code: "private-value" },
    { code: "PGRST002 customer@example.com" },
    { code: 503 },
  ])("never copies arbitrary error fields: %j", (error) => {
    expect(storageFailureTags(error)).toEqual({ storage_code: "unknown" });
    expect(new StorageFailure("fixed", error).message).toBe("fixed");
  });
});
