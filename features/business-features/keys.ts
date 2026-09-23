export const BUSINESS_FEATURES = ["WHATSAPP_CUSTOMER_UPDATES"] as const;
export type BusinessFeature = (typeof BUSINESS_FEATURES)[number];
