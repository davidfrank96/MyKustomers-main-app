export function normalizeCustomerContactEmail(value: string) {
  const trimmed = value.trim();
  const separator = trimmed.lastIndexOf("@");

  if (separator <= 0 || separator === trimmed.length - 1) {
    return trimmed;
  }

  return `${trimmed.slice(0, separator)}@${trimmed.slice(separator + 1).toLowerCase()}`;
}

export function customerContactEmailsMatch(left: string, right: string) {
  return normalizeCustomerContactEmail(left) === normalizeCustomerContactEmail(right);
}
