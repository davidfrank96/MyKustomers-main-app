export type AddonMoney = {
  status: string;
  total_amount_minor: number;
  deposit_amount_minor: number;
};

export function deriveEffectiveBookingTotals(
  booking: { total_amount_minor: number; deposit_amount_minor: number },
  addons: AddonMoney[],
) {
  const confirmed = addons.filter((addon) => addon.status === "CONFIRMED");
  const totalAmountMinor = confirmed.reduce(
    (sum, addon) => sum + addon.total_amount_minor,
    booking.total_amount_minor,
  );
  const depositAmountMinor = confirmed.reduce(
    (sum, addon) => sum + addon.deposit_amount_minor,
    booking.deposit_amount_minor,
  );
  return {
    totalAmountMinor,
    depositAmountMinor,
    balanceAmountMinor: totalAmountMinor - depositAmountMinor,
    confirmedAddonCount: confirmed.length,
  };
}
