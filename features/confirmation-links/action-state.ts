export type ConfirmationLinkActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  confirmationUrl?: string;
  confirmationLinkId?: string;
  expiresAt?: string;
  recipientEmail?: string;
  deliveryStatus?:
    "accepted" | "failed" | "ambiguous" | "queued" | "rate_limited" | "duplicate";
  retryAfterSeconds?: number;
  fieldErrors?: Partial<Record<"recipientEmail", string[]>>;
};

export const initialConfirmationLinkActionState: ConfirmationLinkActionState = {
  status: "idle",
};
