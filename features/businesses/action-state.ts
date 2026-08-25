export type BusinessActionState = {
  status: "idle" | "success" | "error" | "logo_required";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  pendingBusiness?: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

export const initialBusinessActionState: BusinessActionState = {
  status: "idle",
};
