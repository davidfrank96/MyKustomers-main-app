export type CustomerActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialCustomerActionState: CustomerActionState = {
  status: "idle",
};
