import type { Metadata } from "next";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";

export const SEO_SITE = {
  name: "My Kustomers",
  alternateName: "MyKustomers",
  origin: "https://mykustomers.com",
  title: "My Kustomers — Booking & Customer Management for Service Businesses",
  description:
    "Manage customers, bookings, confirmations, payments, delivery and feedback in one clear workspace built for growing service businesses.",
} as const;

// Homepage positioning is separate from the unchanged app/capability defaults.
export const HOMEPAGE_SEO = {
  name: "MyKustomers",
  title: "Keep Customers Informed from Order to Delivery | MyKustomers",
  description:
    "MyKustomers helps businesses confirm orders, keep customers updated, manage changes, deliver professionally, and collect feedback — all in one clear customer journey.",
} as const;

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
};

export function isProductionSeoDeployment() {
  return process.env.VERCEL_ENV === "production";
}

export function absoluteSeoUrl(pathname: string) {
  return new URL(pathname, `${SEO_SITE.origin}/`).toString();
}

export function buildHomepageStructuredData() {
  const organizationId = `${SEO_SITE.origin}/#organization`;
  const websiteId = `${SEO_SITE.origin}/#website`;
  const applicationId = `${SEO_SITE.origin}/#application`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: HOMEPAGE_SEO.name,
        alternateName: SEO_SITE.alternateName,
        url: SEO_SITE.origin,
        logo: absoluteSeoUrl(MYKUSTOMERS_BRAND_ASSETS.pwa.size512),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: HOMEPAGE_SEO.name,
        alternateName: SEO_SITE.alternateName,
        url: SEO_SITE.origin,
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebApplication",
        "@id": applicationId,
        name: HOMEPAGE_SEO.name,
        url: SEO_SITE.origin,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: HOMEPAGE_SEO.description,
        publisher: { "@id": organizationId },
      },
    ],
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
