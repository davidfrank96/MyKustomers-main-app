export type PublicConfirmationStatus =
  | "valid"
  | "already_confirmed"
  | "confirmed"
  | "unavailable"
  | "expired"
  | "revoked"
  | "booking_unavailable"
  | "rate_limited";

export type PublicConfirmationBooking = {
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  customer_name: string;
  booking_reference: string;
  booking_title: string;
  booking_description: string | null;
  scheduled_for: string | null;
  currency: "NGN" | "EUR" | "GBP" | "USD";
  total_amount_minor: number;
  deposit_amount_minor: number;
  balance_amount_minor: number;
  status: string;
  expires_at: string;
  confirmed_at: string | null;
  terms_hash: string;
};

export type PublicConfirmationView = {
  status: PublicConfirmationStatus;
  booking?: PublicConfirmationBooking;
};
