import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrencyAmountInput } from "@/components/forms/currency-amount-input";

describe("CurrencyAmountInput", () => {
  it("groups the visible value and submits an ungrouped canonical value", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <form>
        <label htmlFor="amount">Amount</label>
        <CurrencyAmountInput
          id="amount"
          name="amount"
          onValueChange={onValueChange}
        />
      </form>,
    );
    const input = screen.getByLabelText("Amount");

    fireEvent.change(input, { target: { value: "4000", selectionStart: 4 } });

    expect(input).toHaveValue("4,000");
    expect(onValueChange).toHaveBeenLastCalledWith("4000");
    expect(container.querySelector('input[type="hidden"][name="amount"]')).toHaveValue(
      "4000",
    );
    expect(new FormData(container.querySelector("form")!).get("amount")).toBe("4000");
  });

  it("preserves decimal editing, formatted paste, clearing, and invalid input", () => {
    const { container } = render(
      <CurrencyAmountInput id="amount" name="amount" defaultValue="12500.5" />,
    );
    const input = screen.getByRole("textbox");
    const canonical = container.querySelector('input[type="hidden"]');

    expect(input).toHaveValue("12,500.5");
    fireEvent.change(input, { target: { value: "4,000.50" } });
    expect(input).toHaveValue("4,000.50");
    expect(canonical).toHaveValue("4000.50");

    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
    expect(canonical).toHaveValue("");

    fireEvent.change(input, { target: { value: "1e3" } });
    expect(input).toHaveValue("1e3");
    expect(canonical).toHaveValue("1e3");
  });
});
