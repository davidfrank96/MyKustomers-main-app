export class BusinessMembershipLookupError extends Error {
  constructor() {
    super("Business access could not be verified. Please try again.");
    this.name = "BusinessMembershipLookupError";
  }
}

export function requireBusinessAccessRows<Row>(
  data: Row[] | null,
  error: unknown,
): Row[] {
  if (error || data === null) {
    throw new BusinessMembershipLookupError();
  }

  return data;
}
