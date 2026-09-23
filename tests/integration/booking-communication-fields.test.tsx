import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: false }),
}));
import { BookingCommunicationFields } from "@/components/forms/booking-communication-fields";
afterEach(cleanup);
it("defaults to email and requires an explicit WhatsApp consent choice", () => {
  const { container } = render(
    <form>
      <BookingCommunicationFields />
    </form>,
  );
  expect(screen.getByLabelText("Email")).toBeChecked();
  expect(screen.getByLabelText("WhatsApp")).not.toBeChecked();
  expect(screen.queryByLabelText("WhatsApp number")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("WhatsApp"));
  expect(screen.getByLabelText("WhatsApp number")).toHaveAttribute("type", "tel");
  expect(screen.getByLabelText(/The customer agreed/)).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("WhatsApp number"), {
    target: { value: "+15555550123" },
  });
  fireEvent.click(screen.getByLabelText(/The customer agreed/));
  const form = new FormData(container.querySelector("form")!);
  expect(form.get("whatsappRecipient")).toBe("+15555550123");
  expect(form.get("whatsappConsent")).toBe("on");
  fireEvent.click(screen.getByLabelText("WhatsApp"));
  fireEvent.click(screen.getByLabelText("WhatsApp"));
  expect(screen.getByLabelText(/The customer agreed/)).not.toBeChecked();
});
it("associates validation with labeled keyboard-accessible inputs", () => {
  render(
    <BookingCommunicationFields
      errors={{
        whatsappRecipient: ["Invalid international number"],
        whatsappConsent: ["Consent required"],
      }}
    />,
  );
  fireEvent.click(screen.getByLabelText("WhatsApp"));
  expect(screen.getByLabelText("WhatsApp number")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText(/The customer agreed/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByText("Consent required")).toHaveAttribute("role", "alert");
});
