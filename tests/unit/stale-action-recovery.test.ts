import { describe, expect, it } from "vitest";
import {
  claimStaleActionRecovery,
  isUnrecognizedServerAction,
} from "@/lib/observability/stale-action-recovery";

const stale = () =>
  Object.assign(
    new Error(
      'Server Action "7007f0ffdaa326db840b3c6e17cf676b92d1aaa6da" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    ),
    { name: "UnrecognizedActionError" },
  );

describe("stale Server Action recovery", () => {
  it("recognises only the framework's missing-action signature", () => {
    expect(isUnrecognizedServerAction(stale())).toBe(true);
    expect(isUnrecognizedServerAction(new Error(stale().message))).toBe(false);
    expect(
      isUnrecognizedServerAction(
        Object.assign(new Error("Database unavailable"), {
          name: "UnrecognizedActionError",
        }),
      ),
    ).toBe(false);
  });
  it("permits a single attempt across fresh error instances and remounts", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(claimStaleActionRecovery(new Error("Network unavailable"), storage)).toBe(
      false,
    );
    expect(values.size).toBe(0);
    expect(claimStaleActionRecovery(stale(), storage)).toBe(true);
    expect(claimStaleActionRecovery(stale(), storage)).toBe(false);
    expect([...values.values()]).toEqual(["attempted"]);
  });
  it("does not reload when the guard cannot be persisted", () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Blocked");
      },
    };
    expect(claimStaleActionRecovery(stale(), blocked)).toBe(false);
    expect(
      claimStaleActionRecovery(stale(), { getItem: () => null, setItem: () => {} }),
    ).toBe(false);
  });
});
