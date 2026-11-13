import { StorageFailure } from "@/lib/observability/storage-failure";

export class BusinessMembershipLookupError extends StorageFailure {
  constructor(error?: unknown) {
    super("Business access could not be verified. Please try again.", error);
    this.name = "BusinessMembershipLookupError";
  }
}

export function requireBusinessAccessRows<Row>(
  data: Row[] | null,
  error: unknown,
): Row[] {
  if (error || data === null) {
    throw new BusinessMembershipLookupError(error);
  }

  return data;
}
