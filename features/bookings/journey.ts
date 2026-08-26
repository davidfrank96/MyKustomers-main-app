import type { BookingStatus } from "@/features/bookings/status";

export const bookingJourneyStageKeys = [
  "created",
  "confirmation",
  "work",
  "ready",
  "delivered",
  "completed",
  "feedback",
] as const;

export type BookingJourneyStageKey = (typeof bookingJourneyStageKeys)[number];
export type BookingJourneyStageState =
  "completed" | "current" | "upcoming" | "attention" | "cancelled";

export type BookingJourneyStage = {
  key: BookingJourneyStageKey | "cancelled";
  label: string;
  state: BookingJourneyStageState;
};

export type BookingJourneyAction =
  | {
      kind: "transition";
      toStatus: BookingStatus;
      label: string;
      pendingLabel: string;
      description: string;
    }
  | {
      kind: "anchor";
      href: `#${string}`;
      label: string;
      description: string;
    };

export type BookingJourneyAttention = {
  kind: "reconfirmation" | "amendment" | "addon";
  message: string;
  href: `#${string}`;
  actionLabel: string;
};

export type BookingJourneyState = {
  status: BookingStatus;
  title: string;
  description: string;
  stages: BookingJourneyStage[];
  primaryAction: BookingJourneyAction | null;
  waitingReason: string | null;
  attention: BookingJourneyAttention[];
  complete: boolean;
};

type ConfirmationLinkStatus = "active" | "expired" | "revoked" | "used" | "none";
type FeedbackLinkStatus = "none" | "active" | "expired" | "revoked" | "submitted";

export type DeriveBookingJourneyInput = {
  status: BookingStatus;
  confirmationLinkStatus: ConfirmationLinkStatus;
  feedbackLinkStatus: FeedbackLinkStatus;
  feedbackReceived: boolean;
  confirmationEverCompleted: boolean;
  started: boolean;
  ready: boolean;
  delivered: boolean;
  completed: boolean;
  reconfirmationRequired: boolean;
  pendingAmendment: boolean;
  awaitingAddon: boolean;
  outstandingAmountMinor: number | null;
};

const standardStages: Record<BookingJourneyStageKey, string> = {
  created: "Booking created",
  confirmation: "Customer confirmation",
  work: "Work in progress",
  ready: "Ready for delivery",
  delivered: "Delivered",
  completed: "Payment & completion",
  feedback: "Feedback",
};

const statusStageIndex: Record<Exclude<BookingStatus, "CANCELLED">, number> = {
  DRAFT: 0,
  AWAITING_CUSTOMER: 1,
  CONFIRMED: 2,
  IN_PROGRESS: 2,
  READY: 3,
  DELIVERED: 5,
  COMPLETED: 6,
};

function stageLabel(
  key: BookingJourneyStageKey,
  state: BookingJourneyStageState,
  status: BookingStatus,
  feedbackReceived: boolean,
) {
  if (key === "confirmation") {
    if (state === "completed") return "Customer confirmed";
    if (state === "attention") return "Waiting for customer confirmation";
  }

  if (key === "work") {
    if (state === "completed") return "Work started";
    if (status === "CONFIRMED" && state === "current") return "Work not started";
  }

  if (key === "feedback" && feedbackReceived) return "Feedback received";
  return standardStages[key];
}

function deriveStandardStages(
  status: Exclude<BookingStatus, "CANCELLED">,
  feedbackReceived: boolean,
) {
  const currentIndex = statusStageIndex[status];

  return bookingJourneyStageKeys.map((key, index): BookingJourneyStage => {
    let state: BookingJourneyStageState =
      index < currentIndex
        ? "completed"
        : index === currentIndex
          ? "current"
          : "upcoming";

    if (status === "AWAITING_CUSTOMER" && key === "confirmation") {
      state = "attention";
    }

    if (status === "COMPLETED" && key === "feedback" && feedbackReceived) {
      state = "completed";
    }

    return {
      key,
      label: stageLabel(key, state, status, feedbackReceived),
      state,
    };
  });
}

function deriveCancelledStages(input: DeriveBookingJourneyInput): BookingJourneyStage[] {
  const completed: BookingJourneyStage[] = [
    { key: "created", label: "Booking created", state: "completed" },
  ];

  if (input.confirmationEverCompleted) {
    completed.push({
      key: "confirmation",
      label: "Customer confirmed",
      state: "completed",
    });
  }
  if (input.started) {
    completed.push({ key: "work", label: "Work started", state: "completed" });
  }
  if (input.ready) {
    completed.push({ key: "ready", label: "Ready for delivery", state: "completed" });
  }
  if (input.delivered) {
    completed.push({ key: "delivered", label: "Delivered", state: "completed" });
  }
  if (input.completed) {
    completed.push({ key: "completed", label: "Completed", state: "completed" });
  }

  completed.push({ key: "cancelled", label: "Booking cancelled", state: "cancelled" });
  return completed;
}

function derivePrimaryAction(
  input: DeriveBookingJourneyInput,
): BookingJourneyAction | null {
  switch (input.status) {
    case "DRAFT":
    case "AWAITING_CUSTOMER":
      return {
        kind: "anchor",
        href: "#customer-confirmation",
        label:
          input.confirmationLinkStatus === "active"
            ? "Share confirmation request"
            : "Generate confirmation link",
        description:
          input.status === "DRAFT"
            ? "Send this booking to the customer for confirmation."
            : "Share the secure request and wait for the customer to confirm.",
      };
    case "CONFIRMED":
      return {
        kind: "anchor",
        href: "#operational-progress",
        label: "Review fulfilment status",
        description:
          "This legacy booking keeps its confirmed status for compatibility. New confirmations begin work automatically.",
      };
    case "IN_PROGRESS":
      return {
        kind: "transition",
        toStatus: "READY",
        label: "Mark as ready",
        pendingLabel: "Marking as ready...",
        description:
          "Mark this booking as ready when the order is prepared for delivery or collection.",
      };
    case "READY":
      return {
        kind: "transition",
        toStatus: "DELIVERED",
        label: "Mark as delivered",
        pendingLabel: "Marking as delivered...",
        description: "Mark it as delivered once the customer receives the order.",
      };
    case "DELIVERED":
      if (input.outstandingAmountMinor === null) return null;
      if (input.outstandingAmountMinor > 0) {
        return {
          kind: "anchor",
          href: "#booking-payments",
          label: "Record payment",
          description:
            "Record the outstanding amount before completing this booking.",
        };
      }
      return {
        kind: "transition",
        toStatus: "COMPLETED",
        label: "Complete booking",
        pendingLabel: "Completing booking…",
        description: "Payment is fully recorded. Complete the booking to close fulfilment.",
      };
    case "COMPLETED":
      if (input.feedbackReceived || input.feedbackLinkStatus === "submitted") return null;
      return {
        kind: "anchor",
        href: "#private-feedback",
        label:
          input.feedbackLinkStatus === "active"
            ? "Share feedback request"
            : "Request feedback",
        description: "Ask the customer for private feedback about their experience.",
      };
    case "CANCELLED":
      return null;
  }
}

function deriveSummary(input: DeriveBookingJourneyInput) {
  switch (input.status) {
    case "DRAFT":
      return {
        title: "Booking created",
        description: "The booking is ready to send to the customer for approval.",
      };
    case "AWAITING_CUSTOMER":
      return input.reconfirmationRequired
        ? {
            title: "Waiting for customer confirmation",
            description:
              "The delivery schedule changed. The customer must confirm the updated schedule before work continues.",
          }
        : {
            title: "Waiting for customer confirmation",
            description: "The confirmation request is pending customer approval.",
          };
    case "CONFIRMED":
      return {
        title: "Customer confirmed",
        description:
          "The customer approved this legacy booking. New confirmations move directly into work in progress.",
      };
    case "IN_PROGRESS":
      return {
        title: "Customer confirmed - work in progress",
        description: "The customer confirmed and fulfilment is underway.",
      };
    case "READY":
      return {
        title: "Ready for delivery",
        description: "The order is prepared for delivery or collection.",
      };
    case "DELIVERED":
      return {
        title: "Delivered",
        description: "The customer has received the order.",
      };
    case "COMPLETED":
      return input.feedbackReceived || input.feedbackLinkStatus === "submitted"
        ? {
            title: "Feedback received",
            description: "The booking journey is complete.",
          }
        : {
            title: "Booking completed",
            description:
              "Fulfilment is complete. Private feedback is the final journey step.",
          };
    case "CANCELLED":
      return {
        title: "Booking cancelled",
        description: "The booking lifecycle has ended.",
      };
  }
}

export function deriveBookingJourney(
  input: DeriveBookingJourneyInput,
): BookingJourneyState {
  const feedbackReceived =
    input.feedbackReceived || input.feedbackLinkStatus === "submitted";
  const summary = deriveSummary(input);
  const attention: BookingJourneyAttention[] = [];

  if (input.reconfirmationRequired) {
    attention.push({
      kind: "reconfirmation",
      message:
        "Delivery schedule changed. Customer confirmation is required before work can start.",
      href: "#customer-confirmation",
      actionLabel: "Review confirmation request",
    });
  }
  if (input.pendingAmendment) {
    attention.push({
      kind: "amendment",
      message:
        "Changes are waiting for customer approval. The current confirmed booking remains authoritative until approval.",
      href: "#booking-changes",
      actionLabel: "Review booking changes",
    });
  }
  if (input.awaitingAddon) {
    attention.push({
      kind: "addon",
      message:
        "An add-on is waiting for customer approval. It does not stop the current booking lifecycle.",
      href: "#booking-addons",
      actionLabel: "Review add-on",
    });
  }

  const complete =
    input.status === "CANCELLED" || (input.status === "COMPLETED" && feedbackReceived);

  return {
    status: input.status,
    ...summary,
    stages:
      input.status === "CANCELLED"
        ? deriveCancelledStages(input)
        : deriveStandardStages(input.status, feedbackReceived),
    primaryAction: derivePrimaryAction(input),
    waitingReason:
      input.status === "AWAITING_CUSTOMER"
        ? input.reconfirmationRequired
          ? "Work cannot start until the customer confirms the updated delivery schedule."
          : "Work cannot start until the customer confirms this booking."
        : input.status === "DELIVERED" && input.outstandingAmountMinor === null
          ? "Completion is unavailable until the current payment status can be verified."
          : null,
    attention,
    complete,
  };
}
