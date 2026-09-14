// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import {
  notificationReadCutoff,
  isNotificationMaintenanceMinute,
} from "@/features/notifications/retention";

afterEach(() => vi.useRealTimers());
describe("notification retention clock", () => {
  it("uses 72 elapsed hours from server time across a daylight-saving change", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    expect(notificationReadCutoff()).toBe("2026-10-23T12:00:00.000Z");
  });
  it("keeps four maintenance opportunities per hour while the scheduler runs every minute", () => {
    const opportunities = Array.from({ length: 60 }, (_, minute) => minute).filter(
      (minute) =>
        isNotificationMaintenanceMinute(new Date(Date.UTC(2026, 8, 14, 10, minute))),
    );
    expect(opportunities).toEqual([0, 15, 30, 45]);
  });
});
