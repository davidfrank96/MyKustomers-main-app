function cleanName(value: string | null | undefined, fallback: string) {
  return value?.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() || fallback;
}

export function buildAmendmentShareMessage({
  customerName,
  businessName,
}: {
  customerName?: string | null;
  businessName: string;
}) {
  const firstName = cleanName(customerName, "").split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `${greeting} ${cleanName(businessName, "The business")} has proposed an update to your booking. Please review the changes and confirm them using the secure link below.`;
}

export function buildAmendmentShareTitle(businessName: string) {
  return `Review booking changes with ${cleanName(businessName, "your business")}`;
}
