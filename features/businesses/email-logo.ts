import { BUSINESS_LOGO_PATH_PATTERN } from "./logo-public";

export function getBusinessEmailLogoUrl(logoPath: string | null | undefined) {
  if (!logoPath || !BUSINESS_LOGO_PATH_PATTERN.test(logoPath)) return null;
  return `https://mykustomers.com/brand/business/${logoPath.split("/")[0]}/logo.png`;
}
