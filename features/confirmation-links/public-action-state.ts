export type PublicConfirmationActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: {
    contactEmail?: string[];
    contactPhone?: string[];
  };
};

export const initialPublicConfirmationActionState: PublicConfirmationActionState = {
  status: "idle",
};
