import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BookingIssuesPanel,
  getBookingIssuesSummary,
} from "@/components/bookings/booking-issues-panel";
import type { IssueActionState } from "@/features/feedback/action-state";
import type { BookingIssue } from "@/features/feedback/queries";

type CreateAction = (
  previousState: IssueActionState,
  formData: FormData,
) => Promise<IssueActionState>;

const idleCreateAction = vi.fn<CreateAction>(async () => ({ status: "idle" }));
const resolveAction = vi.fn(async () => undefined);

function issue(overrides: Partial<BookingIssue> = {}): BookingIssue {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    business_id: "22222222-2222-4222-8222-222222222222",
    booking_id: "33333333-3333-4333-8333-333333333333",
    category: "LATE_DELIVERY",
    description: "Delivery finished after the agreed time.",
    status: "OPEN",
    created_by: "44444444-4444-4444-8444-444444444444",
    created_at: "2026-08-30T10:00:00.000Z",
    resolved_by: null,
    resolved_at: null,
    ...overrides,
  };
}

function renderPanel({
  issues = [],
  createAction = idleCreateAction,
}: {
  issues?: BookingIssue[];
  createAction?: CreateAction;
} = {}) {
  return render(
    <BookingIssuesPanel
      issues={issues}
      createAction={createAction}
      resolveAction={resolveAction}
    />,
  );
}

function expandPanel() {
  const trigger = screen.getByRole("button", { name: /Operational issues/ });
  fireEvent.click(trigger);
  return trigger;
}

describe("operational issues presentation", () => {
  it("derives truthful summaries from existing issue states", () => {
    expect(getBookingIssuesSummary([])).toBe("No issues recorded");
    expect(getBookingIssuesSummary([issue()])).toBe("1 open issue");
    expect(
      getBookingIssuesSummary([
        issue(),
        issue({ id: "55555555-5555-4555-8555-555555555555" }),
      ]),
    ).toBe("2 open issues");
    expect(
      getBookingIssuesSummary([
        issue({ status: "RESOLVED", resolved_at: "2026-08-30T11:00:00.000Z" }),
      ]),
    ).toBe("No open issues");
  });

  it("renders the compact empty state and preserves accordion semantics", () => {
    renderPanel();

    const trigger = screen.getByRole("button", { name: /No issues recorded/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Log any problem that impacted this booking.")).toBeVisible();
    expect(screen.getByLabelText("Category")).toBeVisible();
    expect(screen.getByLabelText("Issue description")).toHaveAttribute(
      "maxlength",
      "2000",
    );
    expect(screen.getByRole("button", { name: "Create issue" })).toBeVisible();
    expect(screen.getByText("No issues recorded.")).toBeVisible();
    expect(screen.getByText("Everything looks good so far.")).toBeVisible();

    fireEvent.click(trigger);
    expect(screen.getByText("No issues recorded.")).not.toBeVisible();
  });

  it("tracks the authoritative description limit and submits unchanged values", async () => {
    const createAction = vi.fn<CreateAction>(async () => ({ status: "idle" }));
    renderPanel({ createAction });
    expandPanel();

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "COMMUNICATION_ISSUE" },
    });
    fireEvent.change(screen.getByLabelText("Issue description"), {
      target: { value: "Customer could not reach the business." },
    });
    expect(screen.getByText("38/2000")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create issue" }));

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
    const formData = createAction.mock.calls[0]?.[1];
    expect(formData?.get("category")).toBe("COMMUNICATION_ISSUE");
    expect(formData?.get("description")).toBe("Customer could not reach the business.");
  });

  it("associates existing server validation with the redesigned fields", async () => {
    const createAction = vi.fn<CreateAction>(async () => ({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: {
        category: ["Choose an issue category."],
        description: ["Issue description is required."],
      },
    }));
    renderPanel({ createAction });
    expandPanel();
    const submitButton = screen.getByRole("button", { name: "Create issue" });
    fireEvent.submit(submitButton.closest("form")!);

    expect(await screen.findByText("Choose an issue category.")).toBeVisible();
    expect(screen.getByText("Issue description is required.")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    expect(screen.getByLabelText("Category")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Issue description")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("renders open and resolved evidence and preserves the resolve action", async () => {
    resolveAction.mockClear();
    renderPanel({
      issues: [
        issue(),
        issue({
          id: "55555555-5555-4555-8555-555555555555",
          category: "PAYMENT_BALANCE_ISSUE",
          description: "Balance details needed clarification.",
          status: "RESOLVED",
          resolved_by: "44444444-4444-4444-8444-444444444444",
          resolved_at: "2026-08-30T11:00:00.000Z",
        }),
      ],
    });
    expandPanel();

    const issueList = screen.getByRole("list", { name: "Recorded operational issues" });
    expect(issueList).toBeVisible();
    expect(within(issueList).getByText("Late delivery")).toBeVisible();
    expect(within(issueList).getByText("Payment or balance issue")).toBeVisible();
    expect(within(issueList).getByText("Open")).toBeVisible();
    expect(within(issueList).getByText("Resolved")).toBeVisible();
    expect(within(issueList).getAllByText(/Created Aug 30, 2026/)).toHaveLength(2);
    expect(within(issueList).getByText(/Resolved Aug 30, 2026/)).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Resolve issue" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Resolve issue" }));
    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1));
    expect(resolveAction.mock.calls[0]?.slice(0, 2)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "OPEN",
    ]);
  });
});
