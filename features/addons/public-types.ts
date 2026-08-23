export type PublicAddonStatus =
  | "valid"
  | "confirmed"
  | "already_confirmed"
  | "unavailable"
  | "revoked"
  | "expired"
  | "booking_unavailable"
  | "rate_limited";

export type PublicAddon = {
  business_name: string;
  business_logo_path: string | null;
  business_website: string | null;
  business_instagram: string | null;
  booking_reference: string;
  booking_title: string;
  scheduled_for: string | null;
  title: string;
  description: string | null;
  currency: "NGN" | "EUR" | "GBP" | "USD";
  total_amount_minor: number;
  deposit_amount_minor: number;
  balance_amount_minor: number;
  expires_at: string;
  confirmed_at: string | null;
};

export type PublicAddonView = {
  status: PublicAddonStatus;
  addon?: PublicAddon;
};
