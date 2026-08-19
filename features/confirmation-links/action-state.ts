export type ConfirmationLinkActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  confirmationUrl?: string;
  expiresAt?: string;
};

export const initialConfirmationLinkActionState: ConfirmationLinkActionState = {
  status: "idle",
};
