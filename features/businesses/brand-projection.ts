// Only these already-public identity fields may enter social/email projections.
export type BusinessBrandProjection = {
  previewId: string;
  businessName: string;
  businessLogoPath: string | null;
};

export const BRAND_PREVIEW_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanBusinessBrandName(name: string) {
  return name
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, 160);
}

export function ownedBusinessLogoPath(businessId: string, path: string | null) {
  return path === `${businessId}/logo.webp` ? path : null;
}
