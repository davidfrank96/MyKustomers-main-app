"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEventHandler,
  type InputHTMLAttributes,
} from "react";
import { Input } from "@/components/ui/input";
import {
  moneyCaretAfterFormatting,
  presentMoneyInput,
} from "@/features/bookings/money";

type CurrencyAmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "name" | "onChange" | "type" | "value"
> & {
  name: string;
  defaultValue?: string;
  onValueChange?: (canonicalValue: string) => void;
};

export function CurrencyAmountInput({
  name,
  defaultValue,
  onValueChange,
  disabled,
  onBlur,
  ...props
}: CurrencyAmountInputProps) {
  const initial = presentMoneyInput(defaultValue ?? "");
  const [presentation, setPresentation] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(
      pendingCaretRef.current,
      pendingCaretRef.current,
    );
    pendingCaretRef.current = null;
  }, [presentation.displayValue]);

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    if (presentation.formattable && presentation.canonicalValue.endsWith(".")) {
      const normalized = presentMoneyInput(
        presentation.canonicalValue.slice(0, -1),
      );
      setPresentation(normalized);
      onValueChange?.(normalized.canonicalValue);
    }
    onBlur?.(event);
  };

  return (
    <>
      <Input
        {...props}
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
          setPresentation(next);
          onValueChange?.(next.canonicalValue);
        }}
        data-money-input
      />
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
