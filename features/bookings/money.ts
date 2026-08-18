export const bookingCurrencies = ["NGN", "EUR", "GBP", "USD"] as const;
export type BookingCurrency = (typeof bookingCurrencies)[number];

const currencySymbols: Record<BookingCurrency, string> = {
  NGN: "NGN",
  EUR: "EUR",
  GBP: "GBP",
  USD: "USD",
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

export function deriveBalanceMinor(totalAmountMinor: number, depositAmountMinor: number) {
  return totalAmountMinor - depositAmountMinor;
}

export function formatMoneyMinor(amountMinor: number, currency: BookingCurrency) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencySymbols[currency],
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
