import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/features/customers/actions", () => ({
  archiveCustomerLifecycleAction: vi.fn(async () => ({ status: "success" })),
  restoreCustomerAction: vi.fn(async () => ({ status: "success" })),
  deleteCustomerAction: vi.fn(async () => ({ status: "success" })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { CustomerLifecyclePanel } from "@/components/customers/customer-lifecycle-panel";
import { CustomerRow } from "@/components/customers/customer-row";

const originalPointerEvent = window.PointerEvent;

beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    pointerType: string;
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "";
      this.pointerId = init.pointerId ?? 1;
    }
  }

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: TestPointerEvent,
  });
});

afterAll(() => {
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: originalPointerEvent,
  });
});

describe("customer lifecycle controls", () => {
  it("offers archive but not delete when booking history exists", () => {
    render(
      <CustomerLifecyclePanel
        customerId="00000000-0000-4000-8000-000000000001"
        customerName="Ada Customer"
        isArchived={false}
        hasBookings
        hasActiveBookings
        canDelete
      />,
    );

    expect(screen.getByRole("button", { name: "Archive customer" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete customer" })).toBeNull();
    expect(
      screen.getByText(/booking history and can’t be permanently deleted/i),
    ).toBeVisible();
    expect(screen.getByText(/Active bookings remain active/i)).toBeVisible();
  });

  it("shows owner-only eligible delete behind explicit confirmation", () => {
    render(
      <CustomerLifecyclePanel
        customerId="00000000-0000-4000-8000-000000000002"
        customerName="Zero Booking"
        isArchived={false}
        hasBookings={false}
        hasActiveBookings={false}
        canDelete
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete customer" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByText(/Bookings are never deleted through this action/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete customer" })).toBeVisible();
  });

  it("shows restore and hides permanent delete for a member", () => {
    render(
      <CustomerLifecyclePanel
        customerId="00000000-0000-4000-8000-000000000003"
        customerName="Archived customer"
        isArchived
        hasBookings={false}
        hasActiveBookings={false}
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Restore customer" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete customer" })).toBeNull();
  });

  it("reveals controlled mobile actions only after clear horizontal intent", () => {
    const { container } = render(
      <CustomerRow
        customer={{
          id: "00000000-0000-4000-8000-000000000004",
          name: "Swipe customer",
          email: "swipe@example.com",
          phone: null,
          archived_at: null,
          created_at: "2026-08-31T12:00:00.000Z",
          hasBookings: false,
        }}
        canDelete
        onLifecycle={vi.fn()}
      />,
    );
    const row = container.querySelector<HTMLElement>("[data-customer-row-swipe]")!;

    fireEvent.pointerDown(row, { pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(row, { pointerType: "touch", clientX: 190, clientY: 145 });
    fireEvent.pointerUp(row, { pointerType: "touch", clientX: 190, clientY: 145 });
    expect(row).toHaveStyle({ transform: "translateX(0px)" });

    fireEvent.pointerDown(row, { pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(row, { pointerType: "touch", clientX: 90, clientY: 105 });
    fireEvent.pointerUp(row, { pointerType: "touch", clientX: 90, clientY: 105 });
    expect(row).toHaveStyle({ transform: "translateX(-176px)" });
    expect(
      screen.getByRole("button", { name: "Actions for Swipe customer" }),
    ).toBeVisible();
  });
});
