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
          currency="NGN"
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
      <CurrencyAmountInput
        currency="NGN"
        id="amount"
        name="amount"
        defaultValue="12500.5"
      />,
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

  it("changes only the reading aid when currency changes and retains exact submission", () => {
    const form = (currency: "NGN" | "USD" | "GBP" | "EUR") => (
      <form>
        <label htmlFor="exact">Amount</label>
        <CurrencyAmountInput
          currency={currency}
          id="exact"
          name="amount"
          defaultValue="5000000.25"
        />
      </form>
    );
    const { container, rerender } = render(form("NGN"));
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveValue("5,000,000.25");
    for (const [currency, expected] of [
      ["NGN", "₦5M"],
      ["USD", "$5M"],
      ["GBP", "£5M"],
      ["EUR", "€5M"],
    ] as const) {
      rerender(form(currency));
      expect(container.querySelector("[data-money-compact]")).toHaveTextContent(expected);
      expect(new FormData(container.querySelector("form")!).get("amount")).toBe(
        "5000000.25",
      );
      expect(input).toHaveAttribute("inputmode", "decimal");
      expect(input).toHaveAccessibleDescription(new RegExp(`Currency: ${currency}`));
    }
    fireEvent.change(input, { target: { value: "" } });
    expect(container.querySelector("[data-money-compact]")).toBeNull();
    fireEvent.change(input, { target: { value: "5M" } });
    expect(container.querySelector("[data-money-compact]")).toBeNull();
    expect(new FormData(container.querySelector("form")!).get("amount")).toBe("5M");
  });
});
