import type { Metadata } from "next";
import Link from "next/link";
import { TermsContent } from "@/components/legal/terms-content";
import { absoluteSeoUrl } from "@/lib/seo/site";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LegalBackLink } from "@/components/legal/legal-back-link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using My Kustomers bookings, customer communications and business workflows.",
  alternates: { canonical: absoluteSeoUrl("/terms") },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
      <LegalBackLink />
      <Link
        href="/"
        className="flex min-h-11 w-fit items-center gap-3 rounded font-semibold text-primary sm:text-lg"
      >
        <BrandLogo variant="icon" decorative className="size-10 rounded-lg sm:size-11" />
        My Kustomers
      </Link>
      <h1 className="mb-7 mt-5 text-[1.75rem] font-semibold leading-tight tracking-tight min-[375px]:text-[2rem] sm:mb-8 sm:mt-6 sm:text-[2.75rem]">
        My Kustomers
        <br />
        Terms of Service
      </h1>
      <TermsContent />
    </main>
  );
}
