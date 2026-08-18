const genericAuthMessage = "We could not verify those credentials.";

export function mapSupabaseAuthError(message: string | undefined) {
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

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many attempts. Please wait and try again.";
  }

  return "Something went wrong. Please try again.";
}
