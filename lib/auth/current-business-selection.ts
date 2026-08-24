export const CURRENT_BUSINESS_COOKIE_NAME = "my-customers-current-business";

export type SelectableBusiness = {
  id: string;
};

export function resolveCurrentBusinessId(
  businesses: SelectableBusiness[],
  selectedBusinessId: string | null | undefined,
) {
  if (businesses.length === 0) {
    return null;
  }

  const selectedBusiness = selectedBusinessId
    ? businesses.find((business) => business.id === selectedBusinessId)
    : null;

  return selectedBusiness?.id ?? businesses[0].id;
}
