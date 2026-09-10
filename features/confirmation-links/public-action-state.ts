export type PublicConfirmationActionState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: {
        contactEmail?: string[];
        contactPhone?: string[];
      };
    }
  | {
      status: "success";
      businessName: string | null;
      contactEmail: string | null;
      alreadyConfirmed: boolean;
    };

export const initialPublicConfirmationActionState: PublicConfirmationActionState = {
  status: "idle",
};
