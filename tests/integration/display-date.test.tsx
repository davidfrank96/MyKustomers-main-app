import { describe, expect, it } from "vitest";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils/display-date";

describe("display date formatting", () => {
  it("uses stable punctuation for server and browser rendering", () => {
    const value = new Date(2026, 8, 7, 12, 44);

    expect(formatDisplayDate(value)).toBe("Sep 7, 2026");
    expect(formatDisplayDateTime(value)).toBe("Sep 7, 2026, 12:44 PM");
  });
});
