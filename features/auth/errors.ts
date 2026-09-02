const genericAuthMessage = "We could not verify those credentials.";

type SupabaseAuthErrorLike =
  | string
  | null
  | undefined
  | {
      message?: string;
      status?: number;
      code?: string;
    };

export function isSupabaseAuthRateLimitError(error: SupabaseAuthErrorLike) {
  if (!error) return false;
  if (typeof error !== "string" && error.status === 429) return true;

  const code = typeof error === "string" ? "" : (error.code ?? "");
  const message = typeof error === "string" ? error : (error.message ?? "");
  return /rate.?limit|too.?many|over.?request.?rate/i.test(`${code} ${message}`);
}

export function mapSupabaseAuthError(error: SupabaseAuthErrorLike) {
  const message = typeof error === "string" ? error : error?.message;
  if (!message) {
    return "Something went wrong. Please try again.";
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return genericAuthMessage;
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "An account may already exist for this email. Try logging in or resetting your password.";
  }

  if (normalized.includes("password")) {
    return "The password does not meet the required security rules.";
  }

  if (isSupabaseAuthRateLimitError(error)) {
    return "Too many attempts. Please wait and try again.";
  }

  return "Something went wrong. Please try again.";
}
