import "server-only";
import { getPublicConfirmationImageMetadata } from "./public";
import { renderBusinessSocialImage } from "@/features/businesses/social-image";
export { businessSocialImageHeaders as confirmationImageHeaders } from "@/features/businesses/social-image";

export async function renderConfirmationSocialImage(previewId: string) {
  return renderBusinessSocialImage(
    await getPublicConfirmationImageMetadata(previewId),
    "confirmation",
  );
}
