import { describe, expect, it } from "vitest";
import {
  escapePostgrestLikePattern,
  quotePostgrestFilterValue,
} from "@/lib/supabase/filters";

describe("PostgREST filter helpers", () => {
  it("escapes wildcard characters without discarding searchable punctuation", () => {
    expect(escapePostgrestLikePattern("  ACME_(West)%  ")).toBe("ACME\\_(West)\\%");
  });

  it("quotes reserved filter characters and escapes embedded quotes", () => {
    expect(quotePostgrestFilterValue('+353 (01) 555, "12"')).toBe(
      '"+353 (01) 555, \\"12\\""',
    );
  });
});
