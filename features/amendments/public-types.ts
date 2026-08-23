import type { AmendableBookingField } from "@/features/amendments/terms";

export type AmendmentTerms = {
  business_name: string;
  customer_name: string;
  booking_reference: string;
  title: string;
  description: string | null;
  currency: "NGN" | "EUR" | "GBP" | "USD";
  total_amount_minor: number;
  deposit_amount_minor: number;
  balance_amount_minor: number;
  scheduled_for: string | null;
};

export type PublicAmendmentStatus =
  | "valid"
  | "confirmed"
  | "already_confirmed"
  | "unavailable"
  | "revoked"
  | "expired"
  | "stale"
  | "booking_unavailable"
  | "rate_limited";

export type PublicAmendment = {
  business_name: string;
  business_logo_path: string | null;
  business_website: string | null;
  business_instagram: string | null;
  booking_reference: string;
  reason: string;
  current_terms: AmendmentTerms;
  proposed_terms: AmendmentTerms;
  changed_fields: AmendableBookingField[];
  expires_at: string;
  confirmed_at: string | null;
};

export type PublicAmendmentView = {
  status: PublicAmendmentStatus;
  amendment?: PublicAmendment;
};
