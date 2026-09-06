export const bookingCurrencies = ["NGN", "EUR", "GBP", "USD"] as const;
export type BookingCurrency = (typeof bookingCurrencies)[number];

const currencyLocales: Record<BookingCurrency, string> = {
  NGN: "en-NG",
  EUR: "en-IE",
  GBP: "en-GB",
  USD: "en-US",
};

export function parseMoneyToMinorUnits(input: string) {
  const normalized = input.trim().replace(/,/g, "");

  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const [majorPart, minorPart = ""] = normalized.split(".");
  const major = BigInt(majorPart || "0");
  const minor = BigInt((minorPart + "00").slice(0, 2));
  const value = major * 100n + minor;

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(value);
}

export function minorUnitsToInput(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const major = Math.floor(absolute / 100);
  const minor = absolute % 100;
  return `${sign}${major}.${minor.toString().padStart(2, "0")}`;
}

export type MoneyInputPresentation = {
  canonicalValue: string;
  displayValue: string;
  formattable: boolean;
};

/**
 * Formats a non-negative, two-decimal booking amount for editing while keeping
 * the submitted value free of grouping separators. Invalid input is preserved
 * so the authoritative server validator can return a field-level error.
 */
export function presentMoneyInput(input: string): MoneyInputPresentation {
  const canonicalValue = input.replace(/,/g, "");

  if (!/^\d*(?:\.\d{0,2})?$/.test(canonicalValue)) {
    return { canonicalValue, displayValue: input, formattable: false };
  }

  const hasDecimalPoint = canonicalValue.includes(".");
  const [rawMajor = "", minor = ""] = canonicalValue.split(".");
  const major = rawMajor.replace(/^0+(?=\d)/, "") || (hasDecimalPoint ? "0" : "");
  const groupedMajor = major.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const normalizedCanonical = `${major}${hasDecimalPoint ? `.${minor}` : ""}`;

  return {
    canonicalValue: normalizedCanonical,
    displayValue: `${groupedMajor}${hasDecimalPoint ? `.${minor}` : ""}`,
    formattable: true,
  };
}

export function moneyCaretAfterFormatting(
  rawValue: string,
  rawCaret: number,
  formattedValue: string,
) {
  if (rawCaret >= rawValue.length) return formattedValue.length;

  const meaningfulBeforeCaret = (rawValue.slice(0, rawCaret).match(/[\d.]/g) ?? [])
    .length;
  if (meaningfulBeforeCaret === 0) return 0;

  let meaningfulSeen = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/[\d.]/.test(formattedValue[index])) meaningfulSeen += 1;
    if (meaningfulSeen === meaningfulBeforeCaret) return index + 1;
  }

  return formattedValue.length;
}

export function deriveBalanceMinor(totalAmountMinor: number, depositAmountMinor: number) {
  return totalAmountMinor - depositAmountMinor;
}

export function formatMoneyMinor(amountMinor: number, currency: BookingCurrency) {
  const formatted = new Intl.NumberFormat(currencyLocales[currency], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);

  if (currency === "NGN") {
    return formatted.replace(/^NGN[\s\u00a0]?/, "₦");
  }

  return formatted;
}
