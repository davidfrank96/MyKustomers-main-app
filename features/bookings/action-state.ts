export type BookingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  retryAfterSeconds?: number;
  fieldErrors?: Record<string, string[]>;
  duplicateCandidates?: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  duplicateInput?: {
    name: string;
    email: string | null;
    phone: string | null;
  };
};

export const initialBookingActionState: BookingActionState = {
  status: "idle",
};
