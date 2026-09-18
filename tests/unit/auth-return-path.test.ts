import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  getSafeRedirectPath,
  INTERNAL_REQUEST_PATH_HEADER,
} from "@/lib/security/redirects";
const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: mocks.updateSession }));
import { proxy } from "@/proxy";
beforeEach(() =>
  mocks.updateSession.mockImplementation(async (request: NextRequest) =>
    NextResponse.next({ request }),
  ),
);
describe("trusted protected-route return path", () => {
  it("overwrites a spoofed return header with the actual internal URL", async () => {
    const request = new NextRequest(
      "https://mykustomers.com/bookings/example?tab=details",
      { headers: { [INTERNAL_REQUEST_PATH_HEADER]: "https://evil.example" } },
    );
    const response = await proxy(request);
    expect(request.headers.get(INTERNAL_REQUEST_PATH_HEADER)).toBe(
      "/bookings/example?tab=details",
    );
    expect(
      response.headers.get(`x-middleware-request-${INTERNAL_REQUEST_PATH_HEADER}`),
    ).toBe("/bookings/example?tab=details");
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "data:text/html,test",
    "/\\evil.example",
    "/\n/evil.example",
  ])("rejects unsafe destination %s", (value) => {
    expect(getSafeRedirectPath(value)).toBe("/dashboard");
  });
});
