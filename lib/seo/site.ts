import type { Metadata } from "next";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";

export const SEO_SITE = {
  name: "My Kustomers",
  alternateName: "MyKustomers",
  origin: "https://mykustomers.com",
  title: "My Kustomers — Booking & Customer Management for Small Businesses",
  description:
    "Manage customers, bookings, confirmations, payments, delivery and feedback in one clear workspace built for growing service businesses.",
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
        name: SEO_SITE.name,
        alternateName: SEO_SITE.alternateName,
        url: SEO_SITE.origin,
        logo: absoluteSeoUrl(MYKUSTOMERS_BRAND_ASSETS.pwa.size512),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SEO_SITE.name,
        alternateName: SEO_SITE.alternateName,
        url: SEO_SITE.origin,
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebApplication",
        "@id": applicationId,
        name: SEO_SITE.name,
        url: SEO_SITE.origin,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SEO_SITE.description,
        publisher: { "@id": organizationId },
      },
    ],
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
