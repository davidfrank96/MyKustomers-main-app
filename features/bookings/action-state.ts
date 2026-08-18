export type BookingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialBookingActionState: BookingActionState = {
  status: "idle",
};
