import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutForm } from "@/components/notifications/logout-form";

const mocks = vi.hoisted(() => ({ logout: vi.fn(), badge: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ logoutAction: mocks.logout }));
vi.mock("@/features/notifications/client", () => ({ updateAppBadge: mocks.badge }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.logout.mockResolvedValue(undefined);
  mocks.badge.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("shared logout client cleanup", () => {
  it("unsubscribes and clears the badge before invoking authoritative logout", async () => {
    const unsubscribe = vi.fn(async () => true);
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: { getSubscription: async () => ({ unsubscribe }) },
        }),
      },
    });
    render(<LogoutForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Log out" }).closest("form")!);
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.badge).toHaveBeenCalledWith(0);
    expect(mocks.badge.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.logout.mock.invocationCallOrder[0],
    );
  });
  it("still reaches server-side revocation when optional browser push cleanup fails", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: async () => {
          throw new Error("Browser unavailable");
        },
      },
    });
    render(<LogoutForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Log out" }).closest("form")!);
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  });
});
