export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  code?: "rate_limited" | "verification_required" | "verification_resent";
  retryAfterSeconds?: number;
  verification?: {
    email: string;
    retryAfterSeconds: number;
  };
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
