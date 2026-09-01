import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessOnboardingForm } from "@/components/forms/business-onboarding-form";
import { initialBusinessActionState } from "@/features/businesses/action-state";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

function renderCreateBusinessForm() {
  const action = vi.fn(async () => initialBusinessActionState);
  render(<BusinessOnboardingForm action={action} mode="create" />);
  return { action };
}

describe("create-business presentation", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.refresh.mockReset();
  });

  it("keeps every repository-backed field and reflects actual required state", () => {
    renderCreateBusinessForm();

    expect(screen.getByRole("heading", { name: "Business profile" })).toBeVisible();
    expect(screen.getByLabelText(/^Logo image/)).toBeRequired();

    for (const label of ["Business name", "Business slug"]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeRequired();
    }
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveAttribute(
      "aria-required",
      "true",
    );

    for (const label of [
      "Description",
      "Phone",
      "Business email",
      "WhatsApp",
      "Instagram",
      "Website",
      "Address",
    ]) {
      expect(screen.getByLabelText(label), label).not.toBeRequired();
    }
  });

  it("uses the approved guidance while retaining native input semantics", () => {
    renderCreateBusinessForm();

    expect(screen.getByPlaceholderText("Enter your business name")).toHaveAttribute(
      "autocomplete",
      "organization",
    );
    expect(
      screen.getByPlaceholderText("Enter a short unique name (e.g., bright-cleaning)"),
    ).toHaveAttribute("inputmode", "url");
    expect(screen.getByPlaceholderText("Enter phone number")).toHaveAttribute(
      "type",
      "tel",
    );
    expect(screen.getByPlaceholderText("Enter business email")).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByPlaceholderText("example.com")).toHaveAttribute("type", "url");
    expect(screen.getByLabelText(/^Logo image/)).toHaveAttribute(
      "accept",
      "image/png,image/jpeg,image/webp",
    );
  });

  it("preserves the logo gate and full-width pending-capable create action", () => {
    const { action } = renderCreateBusinessForm();
    fireEvent.click(screen.getByRole("button", { name: "Create business" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a business logo before creating your business.",
    );
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create business" })).toHaveClass("w-full");
    expect(
      screen.getByText("Your business & customer data are protected and private."),
    ).toBeVisible();
  });

  it("continues deriving the existing normalized slug from the business name", () => {
    renderCreateBusinessForm();
    fireEvent.change(screen.getByLabelText(/^Business name/), {
      target: { value: "  Café & Events!!!  " },
    });

    expect(screen.getByLabelText(/^Business slug/)).toHaveValue("cafe-events");
  });
});
