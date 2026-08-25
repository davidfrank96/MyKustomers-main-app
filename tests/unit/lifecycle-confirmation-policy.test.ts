import fs from "node:fs";
import { describe, expect, it } from "vitest";

const statusForm = fs.readFileSync("components/forms/booking-status-form.tsx", "utf8");
const completionDialog = fs.readFileSync(
  "components/forms/booking-completion-dialog.tsx",
  "utf8",
);
const bookingJourney = fs.readFileSync("components/bookings/booking-journey.tsx", "utf8");

describe("booking lifecycle confirmation policy", () => {
  it("does not depend on browser-native blocking dialogs", () => {
    const lifecycleUi = `${statusForm}\n${completionDialog}\n${bookingJourney}`;

    expect(lifecycleUi).not.toMatch(/window\.(confirm|alert|prompt)/);
    expect(lifecycleUi).not.toContain("window.open");
  });

  it("requires an application-owned dialog before completing a booking", () => {
    expect(bookingJourney).toContain("BookingCompletionDialog");
    expect(completionDialog).toContain("Complete this booking?");
    expect(completionDialog).toContain(
      "This will mark the booking as completed and move it to the feedback stage.",
    );
    expect(completionDialog).toContain('type="submit"');
    expect(completionDialog).toContain('role="alert"');
    expect(completionDialog).toContain("disabled={pending}");
  });
});
