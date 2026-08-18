export type BusinessActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialBusinessActionState: BusinessActionState = {
  status: "idle",
};
