import { publicEnv } from "@/lib/config/public-env";

export const BUSINESS_LOGO_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/logo\.webp$/;

export function getBusinessLogoPublicUrl(logoPath: string | null | undefined) {
  const baseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl || !logoPath || !BUSINESS_LOGO_PATH_PATTERN.test(logoPath)) {
    return null;
  }

  const encodedPath = logoPath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/public/business-logos/${encodedPath}`;
}

export function getBusinessInstagramUrl(handle: string | null | undefined) {
  if (!handle || !/^[a-z0-9._]{1,30}$/.test(handle)) {
    return null;
  }

  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

export function getSafeBusinessWebsiteUrl(website: string | null | undefined) {
  if (!website || website.length > 2048) {
    return null;
  }

  try {
    const url = new URL(website);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
