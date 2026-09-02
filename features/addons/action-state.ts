export type AddonActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  addonUrl?: string;
  addonId?: string;
  confirmationLinkId?: string;
  expiresAt?: string;
  retryAfterSeconds?: number;
};

export const initialAddonActionState: AddonActionState = { status: "idle" };

export type PublicAddonActionState = {
  status: "idle" | "error";
  message?: string;
};

export const initialPublicAddonActionState: PublicAddonActionState = {
  status: "idle",
};
