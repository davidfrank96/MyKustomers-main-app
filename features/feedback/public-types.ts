export type PublicFeedbackStatus =
  | "valid"
  | "submitted"
  | "unavailable"
  | "expired"
  | "revoked"
  | "booking_unavailable"
  | "rate_limited"
  | "invalid_feedback"
  | "already_submitted";

export type PublicFeedbackBooking = {
  business_name: string;
  booking_reference: string;
  booking_title: string;
  completed_at: string | null;
  expires_at: string;
};

export type PublicFeedbackView = {
  status: PublicFeedbackStatus;
  booking?: PublicFeedbackBooking;
};
