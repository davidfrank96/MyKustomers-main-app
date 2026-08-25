export const PENDING_BUSINESS_ONBOARDING_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function isBusinessOnboardingPending(value: string) {
  return new Date(value).getTime() === 0;
}
