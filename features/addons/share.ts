function cleanName(value: string | null | undefined, fallback: string) {
  return value?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || fallback;
}

export function buildAddonShareMessage({
  customerName,
  businessName,
}: {
  customerName?: string | null;
  businessName: string;
}) {
  const firstName = cleanName(customerName, "").split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `${greeting} ${cleanName(businessName, "The business")} has added an item to your existing booking. Please review the addition and confirm it using the secure link below.`;
}

export function buildAddonShareTitle(businessName: string) {
  return `Review a booking addition with ${cleanName(businessName, "your business")}`;
}
