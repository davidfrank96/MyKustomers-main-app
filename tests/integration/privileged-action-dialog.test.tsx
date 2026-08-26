import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PrivilegedActionDialog,
  type PrivilegedActionState,
} from "@/components/admin/privileged-action-dialog";

describe("PrivilegedActionDialog", () => {
  it("uses an accessible application dialog with bounded reason capture", async () => {
    const action = vi.fn(async (): Promise<PrivilegedActionState> => ({
      status: "success",
      message: "Done",
    }));

    render(
      <PrivilegedActionDialog
        actionTitle="Review privileged action"
        consequence="This action changes platform state."
        triggerLabel="Open action"
        confirmLabel="Confirm action"
        requiresReason
        action={action}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open action" }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Review privileged action" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Reason")).toHaveAttribute("required");
    expect(screen.getByLabelText("Reason")).toHaveAttribute("maxlength", "500");
    expect(screen.getByRole("button", { name: "Confirm action" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
