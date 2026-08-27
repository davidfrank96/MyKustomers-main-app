import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaReliabilityCoordinator } from "@/components/layout/pwa-reliability-coordinator";
import { PWA_RESUME_THRESHOLD_MS } from "@/features/pwa/reconciliation";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
let pathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => navigation,
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function dispatchPersistedPageShow() {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  act(() => window.dispatchEvent(event));
}

describe("PwaReliabilityCoordinator", () => {
  beforeEach(() => {
    pathname = "/dashboard";
    navigation.push.mockReset();
    navigation.refresh.mockReset();
    setOnline(true);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not refresh after a short suspension but refreshes after a meaningful one", () => {
    vi.useFakeTimers();
    render(<PwaReliabilityCoordinator />);

    setVisibility("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(PWA_RESUME_THRESHOLD_MS - 1));
    setVisibility("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigation.refresh).not.toHaveBeenCalled();

    setVisibility("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(PWA_RESUME_THRESHOLD_MS));
    setVisibility("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("reconciles a BFCache restoration and deduplicates the immediate duplicate", () => {
    render(<PwaReliabilityCoordinator />);
    dispatchPersistedPageShow();
    dispatchPersistedPageShow();
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("explains offline state, blocks the failed route attempt, and retries it online", () => {
    render(
      <>
        <PwaReliabilityCoordinator />
        <Link href="/bookings">Bookings</Link>
      </>,
    );
    setOnline(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByRole("alert")).toHaveTextContent("You're offline");

    expect(fireEvent.click(screen.getByRole("link", { name: "Bookings" }))).toBe(false);
    expect(navigation.push).not.toHaveBeenCalled();

    setOnline(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(navigation.push).toHaveBeenCalledWith("/bookings");
  });

  it("blocks offline mutations without queuing or replaying the form", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <>
        <PwaReliabilityCoordinator />
        <form onSubmit={submit}>
          <button type="submit">Save</button>
        </form>
      </>,
    );
    setOnline(false);
    act(() => window.dispatchEvent(new Event("offline")));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submit).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("keeps a reconnect navigation deferred until the dirty form is reset", async () => {
    render(
      <>
        <PwaReliabilityCoordinator />
        <form>
          <label htmlFor="offline-title">Title</label>
          <input id="offline-title" defaultValue="" />
          <button type="reset">Discard</button>
        </form>
        <Link href="/bookings">Bookings</Link>
      </>,
    );
    fireEvent.input(screen.getByLabelText("Title"), {
      target: { value: "Unsaved booking" },
    });
    setOnline(false);
    act(() => window.dispatchEvent(new Event("offline")));
    fireEvent.click(screen.getByRole("link", { name: "Bookings" }));

    setOnline(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Finish or close");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/bookings"));
  });

  it("preserves a dirty form and defers authoritative refresh", () => {
    render(
      <>
        <PwaReliabilityCoordinator />
        <form>
          <label htmlFor="title">Title</label>
          <input id="title" defaultValue="" />
        </form>
      </>,
    );
    const title = screen.getByLabelText("Title");
    fireEvent.input(title, { target: { value: "Unsaved booking" } });
    dispatchPersistedPageShow();

    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(title).toHaveValue("Unsaved booking");
    expect(screen.getByRole("status")).toHaveTextContent("Finish or close");
  });

  it("detects browser-restored form values even when no input event is replayed", () => {
    render(
      <>
        <PwaReliabilityCoordinator />
        <form>
          <label htmlFor="restored-title">Restored title</label>
          <input id="restored-title" defaultValue="" />
        </form>
      </>,
    );
    const title = screen.getByLabelText("Restored title") as HTMLInputElement;
    title.value = "Restored WebKit value";
    dispatchPersistedPageShow();

    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(title).toHaveValue("Restored WebKit value");
    expect(screen.getByRole("status")).toHaveTextContent("Finish or close");
  });

  it("does not refresh while an application dialog is open", () => {
    render(
      <>
        <PwaReliabilityCoordinator />
        <div role="dialog" data-state="open" aria-label="Record payment" />
      </>,
    );
    dispatchPersistedPageShow();
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Finish or close");
  });
});
