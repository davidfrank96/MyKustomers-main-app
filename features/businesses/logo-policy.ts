export const MAX_BUSINESS_LOGO_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_BUSINESS_LOGO_TRANSPORT_BYTES = 3 * 1024 * 1024;
export const MAX_LOGO_SOURCE_EDGE = 6000;
export const MAX_LOGO_SOURCE_PIXELS = 25_000_000;
export const MAX_LOGO_OUTPUT_EDGE = 512;
export const MAX_LOGO_OUTPUT_BYTES = 200 * 1024;
export const MAX_LOGO_TRANSPORT_EDGE = 2048;

export const BUSINESS_LOGO_SOURCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type BusinessLogoSourceType = (typeof BUSINESS_LOGO_SOURCE_TYPES)[number];
