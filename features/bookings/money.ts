export const bookingCurrencies = ["NGN", "EUR", "GBP", "USD"] as const;
export type BookingCurrency = (typeof bookingCurrencies)[number];

export function isBookingCurrency(value: unknown): value is BookingCurrency {
  return bookingCurrencies.some((currency) => currency === value);
}

export const bookingCurrencySymbols: Record<BookingCurrency, string> = {
  NGN: "₦",
  EUR: "€",
  GBP: "£",
  USD: "$",
};

/** A reading aid only. Never feed this rounded display into money persistence. */
export function formatCompactMoneyMinor(amountMinor: number, currency: BookingCurrency) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 100_000) return null;
  const amount = BigInt(amountMinor);
  const units = [
    [100_000n, "K"],
    [100_000_000n, "M"],
    [100_000_000_000n, "B"],
    [100_000_000_000_000n, "T"],
  ] as const;
  let index = 0;
  while (index < units.length - 1 && amount >= units[index + 1][0]) index++;
  const rounded = (scale: bigint) => (amount * 100n + scale / 2n) / scale;
  if (index < units.length - 1 && rounded(units[index][0]) >= 100_000n) index++;
  const [scale, suffix] = units[index];
  const hundredths = rounded(scale);
  const fraction = (hundredths % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return `${bookingCurrencySymbols[currency]}${hundredths / 100n}${fraction ? `.${fraction}` : ""}${suffix}`;
}

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
  // Split before formatting: dividing a large safe integer by 100 can lose
  // its final cent (MAX_SAFE_INTEGER previously displayed .90 instead of .91).
  const minor = BigInt(amountMinor);
  const remainder = minor < 0n ? -(minor % 100n) : minor % 100n;
  const major = minor / 100n;
  const formatter = new Intl.NumberFormat(currencyLocales[currency], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: remainder === 0n ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter
    .formatToParts(major === 0n && minor < 0n ? -0 : major)
    .map((part) =>
      part.type === "fraction" ? remainder.toString().padStart(2, "0") : part.value,
    )
    .join("");

  if (currency === "NGN") {
    return formatted.replace(/^NGN[\s\u00a0]?/, "₦");
  }

  return formatted;
}
