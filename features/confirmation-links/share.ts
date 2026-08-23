export const confirmationShareMethods = [
  "native_share",
  "whatsapp",
  "telegram",
  "copy_message",
  "copy_link",
] as const;

export type ConfirmationShareMethod = (typeof confirmationShareMethods)[number];

type ShareMessageInput = {
  customerName?: string | null;
  businessName: string;
  confirmationUrl: string;
};

function normalizeHumanName(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return normalized || fallback;
}

export function buildCustomerConfirmationMessageText({
  customerName,
  businessName,
}: Omit<ShareMessageInput, "confirmationUrl">) {
  const safeBusinessName = normalizeHumanName(businessName, "The business");
  const safeCustomerName = normalizeHumanName(customerName, "");
  const firstName = safeCustomerName.split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return `${greeting} ${safeBusinessName} has sent you your order details for confirmation. Please review the details and confirm that everything is correct using the secure link below.`;
}

export function buildCustomerConfirmationShareTitle(businessName: string) {
  return `Review your order with ${normalizeHumanName(businessName, "your business")}`;
}

export function composeCustomerConfirmationShareMessage(
  message: string,
  confirmationUrl: string,
) {
  return `${message.trim()}\n\n${confirmationUrl}`;
}

export function buildCustomerConfirmationShareMessage(input: ShareMessageInput) {
  return composeCustomerConfirmationShareMessage(
    buildCustomerConfirmationMessageText(input),
    input.confirmationUrl,
  );
}

export function buildWhatsAppShareUrl(message: string, confirmationUrl: string) {
  const url = new URL("https://wa.me/");
  url.searchParams.set(
    "text",
    composeCustomerConfirmationShareMessage(message, confirmationUrl),
  );
  return url.toString();
}

export function buildTelegramShareUrl(message: string, confirmationUrl: string) {
  const url = new URL("https://t.me/share/url");
  url.searchParams.set("url", confirmationUrl);
  url.searchParams.set("text", message.trim());
  return url.toString();
}

export function isConfirmationShareMethod(
  value: unknown,
): value is ConfirmationShareMethod {
  return confirmationShareMethods.includes(value as ConfirmationShareMethod);
}
