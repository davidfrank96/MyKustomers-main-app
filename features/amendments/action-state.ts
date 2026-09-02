export type AmendmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  amendmentUrl?: string;
  amendmentId?: string;
  expiresAt?: string;
  retryAfterSeconds?: number;
};

export const initialAmendmentActionState: AmendmentActionState = {
  status: "idle",
};

export type PublicAmendmentActionState = {
  status: "idle" | "error";
  message?: string;
};

export const initialPublicAmendmentActionState: PublicAmendmentActionState = {
  status: "idle",
};
