import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerForm } from "@/components/forms/customer-form";
import { initialCustomerActionState } from "@/features/customers/action-state";

const action = async () => initialCustomerActionState;

describe("customer detail form presentation", () => {
  it("renders the approved edit hierarchy with accessible icon fields", () => {
    render(
      <CustomerForm
        action={action}
        submitLabel="Save customer"
        presentation="detail"
        initialValues={{
          name: "Jide Alabi",
          email: "davidfrank96.df@gmail.com",
          phone: null,
          notes: null,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Customer details" })).toBeVisible();
    expect(screen.getByText("Update your customer information")).toBeVisible();

    expect(screen.getByLabelText("Name")).toHaveValue("Jide Alabi");
    expect(screen.getByLabelText("Email")).toHaveValue("davidfrank96.df@gmail.com");
    expect(screen.getByLabelText("Phone (optional)")).toHaveAttribute(
      "placeholder",
      "Enter phone number",
    );
    expect(screen.getByLabelText("Notes (optional)")).toHaveAttribute(
      "placeholder",
      "Add any notes about this customer...",
    );
    expect(screen.getByLabelText("Notes (optional)")).toHaveAttribute(
      "maxlength",
      "5000",
    );

    const saveButton = screen.getByRole("button", { name: "Save customer" });
    expect(saveButton).toHaveClass("h-14", "w-full");
  });

  it("renders the approved customer creation hierarchy without requiring contact fields", () => {
    render(
      <CustomerForm
        action={action}
        submitLabel="Create customer"
        presentation="create"
        cancelHref="/customers"
      />,
    );

    expect(screen.getByRole("heading", { name: "Customer details" })).toBeVisible();
    expect(
      screen.getByText("Add contact information to keep your records organized."),
    ).toBeVisible();
    expect(screen.getAllByText("Optional")).toHaveLength(3);

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "placeholder",
      "Enter customer name",
    );
    expect(screen.getByLabelText("Email")).not.toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "placeholder",
      "Enter email address (optional)",
    );
    expect(screen.getByLabelText("Phone")).not.toBeRequired();
    expect(screen.getByLabelText("Phone")).toHaveAttribute(
      "placeholder",
      "Enter phone number (optional)",
    );
    expect(screen.getByLabelText("Notes")).toHaveAttribute(
      "placeholder",
      "Add any helpful notes about this customer...",
    );
    expect(screen.getByLabelText("Notes")).toHaveAttribute("maxlength", "5000");
    expect(screen.getByText("0/5000")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Helpful note" },
    });
    expect(screen.getByText("12/5000")).toBeVisible();

    expect(
      screen.getByText(
        "Customer details are private to your business and help you manage bookings and communication.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/customers",
    );
    expect(screen.getByRole("button", { name: "Create customer" })).toHaveClass(
      "h-14",
      "w-full",
    );
  });
});
