export type FeedbackLinkActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  feedbackUrl?: string;
  expiresAt?: string;
};

export const initialFeedbackLinkActionState: FeedbackLinkActionState = {
  status: "idle",
};

export type IssueActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialIssueActionState: IssueActionState = {
  status: "idle",
};
