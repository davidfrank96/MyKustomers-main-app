import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/notifications/notification-center";
import { NOTIFICATIONS_CHANGED } from "@/features/notifications/contracts";

const client = vi.hoisted(() => ({
  notificationRequest: vi.fn(),
  updateAppBadge: vi.fn(async () => undefined),
  registerNotificationWorker: vi.fn(async () => undefined),
  notificationsChanged: vi.fn(),
}));
vi.mock("@/features/notifications/client", () => client);

describe("notification bell request lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("coalesces a burst into one active request and one fresh follow-up", async () => {
    const replies: Array<(value: { unreadCount: number }) => void> = [];
    client.notificationRequest.mockImplementation(
      () => new Promise((resolve) => replies.push(resolve)),
    );
    render(<NotificationBell />);
    await waitFor(() => expect(client.notificationRequest).toHaveBeenCalledTimes(1));
    act(() => {
      for (let i = 0; i < 6; i++) window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    });
    expect(client.notificationRequest).toHaveBeenCalledTimes(1);
    await act(async () => {
      replies[0]({ unreadCount: 1 });
    });
    expect(client.notificationRequest).toHaveBeenCalledTimes(2);
    await act(async () => {
      replies[1]({ unreadCount: 2 });
    });
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();
  });

  it("does not let an older count overwrite a newer authoritative list result", async () => {
    let resolve!: (value: { unreadCount: number }) => void;
    client.notificationRequest.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<NotificationBell />);
    await waitFor(() => expect(client.notificationRequest).toHaveBeenCalledTimes(1));
    act(() =>
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED, { detail: 0 })),
    );
    await act(async () => {
      resolve({ unreadCount: 8 });
    });
    expect(screen.getByRole("button", { name: "Notifications" })).toBeVisible();
    expect(client.updateAppBadge).not.toHaveBeenCalled();
  });

  it("ignores a delayed response after the workspace shell unmounts", async () => {
    let resolve!: (value: { unreadCount: number }) => void;
    client.notificationRequest.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(<NotificationBell />);
    await waitFor(() => expect(client.notificationRequest).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      resolve({ unreadCount: 8 });
    });
    expect(client.updateAppBadge).not.toHaveBeenCalled();
  });

  it("aborts a suspended read and allows a fresh read immediately on return", async () => {
    const replies: Array<(value: { unreadCount: number }) => void> = [];
    client.notificationRequest.mockImplementation(
      () => new Promise((resolve) => replies.push(resolve)),
    );
    render(<NotificationBell />);
    await waitFor(() => expect(client.notificationRequest).toHaveBeenCalledTimes(1));
    const signal = client.notificationRequest.mock.calls[0][1].signal as AbortSignal;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(signal.aborted).toBe(true);
    act(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)));
    expect(client.notificationRequest).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(client.notificationRequest).toHaveBeenCalledTimes(2);
    await act(async () => {
      replies[0]({ unreadCount: 8 });
    });
    expect(client.updateAppBadge).not.toHaveBeenCalled();
    await act(async () => {
      replies[1]({ unreadCount: 1 });
    });
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
  });
});
