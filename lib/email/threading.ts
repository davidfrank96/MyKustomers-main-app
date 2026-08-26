import "server-only";
import { createHash } from "node:crypto";
import type { TransactionalEmailMessage } from "@/lib/email/types";

type BookingThreadInput = {
  bookingId: string;
  emailEventId: string;
  businessName: string;
  bookingReference: string;
};

function opaqueCorrelation(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function applyBookingEmailThreading(
  message: TransactionalEmailMessage,
  input: BookingThreadInput,
): TransactionalEmailMessage {
  return {
    ...message,
    subject: `Booking ${input.bookingReference} - ${input.businessName}`,
    headers: {
      "X-MyKustomers-Thread-Key": opaqueCorrelation(`booking/${input.bookingId}`),
      "X-MyKustomers-Message-Key": opaqueCorrelation(
        `email-event/${input.emailEventId}`,
      ),
    },
  };
}
