"use client";

import {
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type FocusEventHandler,
  type InputHTMLAttributes,
} from "react";
import { Input } from "@/components/ui/input";
import {
  bookingCurrencySymbols,
  formatCompactMoneyMinor,
  moneyCaretAfterFormatting,
  parseMoneyToMinorUnits,
  presentMoneyInput,
  type BookingCurrency,
} from "@/features/bookings/money";
import { cn } from "@/lib/utils/cn";

type CurrencyAmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "name" | "onChange" | "type" | "value"
> & {
  name: string;
  currency: BookingCurrency;
  defaultValue?: string;
  onValueChange?: (canonicalValue: string) => void;
};

export function CurrencyAmountInput({
  name,
  currency,
  defaultValue,
  onValueChange,
  disabled,
  onBlur,
  className,
  "aria-describedby": describedBy,
  ...props
}: CurrencyAmountInputProps) {
  const initial = presentMoneyInput(defaultValue ?? "");
  const [presentation, setPresentation] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const descriptionId = useId();
  const amountMinor = parseMoneyToMinorUnits(presentation.canonicalValue);
  const compact =
    amountMinor === null ? null : formatCompactMoneyMinor(amountMinor, currency);

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  }, [presentation]);

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    if (presentation.formattable && presentation.canonicalValue.endsWith(".")) {
      const normalized = presentMoneyInput(presentation.canonicalValue.slice(0, -1));
      setPresentation(normalized);
      onValueChange?.(normalized.canonicalValue);
    }
    onBlur?.(event);
  };

  return (
    <>
      <div className="relative min-w-0">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
        >
          {bookingCurrencySymbols[currency]}
        </span>
        <Input
          {...props}
          className={cn("pl-8 tabular-nums", className)}
          aria-describedby={[
            describedBy,
            descriptionId,
            compact ? `${descriptionId}-compact` : null,
          ]
            .filter(Boolean)
            .join(" ")}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={presentation.displayValue}
          disabled={disabled}
          onBlur={handleBlur}
          onChange={(event) => {
            const rawValue = event.target.value;
            const next = presentMoneyInput(rawValue);
            pendingCaretRef.current = moneyCaretAfterFormatting(
              rawValue,
              event.target.selectionStart ?? rawValue.length,
              next.displayValue,
            );
            // Deleting a grouping separator must advance the caret even when
            // formatting restores exactly the same display string.
            if (
              (event.nativeEvent as InputEvent).inputType === "deleteContentForward" &&
              next.displayValue === presentation.displayValue &&
              next.displayValue[pendingCaretRef.current] === ","
            ) {
              pendingCaretRef.current += 1;
            }
            setPresentation(next);
            onValueChange?.(next.canonicalValue);
          }}
          data-money-input
        />
      </div>
      <span id={descriptionId} className="sr-only">
        Currency: {currency}.
      </span>
      {compact ? (
        <p
          id={`${descriptionId}-compact`}
          className="mt-1 text-xs leading-5 text-muted-foreground tabular-nums"
          data-money-compact
        >
          <span className="sr-only">Approximate amount: </span>
          {compact}
        </p>
      ) : null}
      <input
        type="hidden"
        name={name}
        value={presentation.canonicalValue}
        disabled={disabled}
        data-money-canonical
      />
    </>
  );
}
