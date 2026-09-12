// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ after: vi.fn(), process: vi.fn(), capture: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/features/notifications/worker", () => ({
  processNotifications: mocks.process,
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.capture }));
import { POST } from "@/app/api/internal/notifications/process/route";
const secret = "test-worker-credential-".repeat(3);
const request = (body = "{}", authorization = `Bearer ${secret}`) =>
  new Request("https://mykustomers.com/api/internal/notifications/process", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body,
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NOTIFICATION_WORKER_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());
it("rejects unauthorized and malformed jobs without scheduling work", async () => {
  expect((await POST(request("{}", "Bearer wrong"))).status).toBe(401);
  expect((await POST(request('{"extra":true}'))).status).toBe(400);
  expect((await POST(request('"' + "x".repeat(300) + '"'))).status).toBe(413);
  expect(mocks.after).not.toHaveBeenCalled();
  expect(mocks.process).not.toHaveBeenCalled();
});
it("acknowledges promptly and runs the worker in Next's retained lifetime", async () => {
  const response = await POST(request());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.process).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledTimes(1);
  await mocks.after.mock.calls[0][0]();
  expect(mocks.process).toHaveBeenCalledTimes(1);
});
it("records a fixed failure message without leaking provider errors", async () => {
  mocks.process.mockRejectedValue(new Error("sensitive endpoint and key"));
  await POST(request());
  await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
  expect(mocks.capture).toHaveBeenCalledWith("Notification worker unavailable", {
    level: "error",
    tags: { notification_stage: "worker" },
  });
});
