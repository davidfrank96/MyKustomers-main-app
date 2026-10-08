import type { Metadata } from "next";
import Link from "next/link";
import { TermsContent } from "@/components/legal/terms-content";
import { absoluteSeoUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using My Kustomers bookings, customer communications and business workflows.",
  alternates: { canonical: absoluteSeoUrl("/terms") },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-medium text-primary"
      >
        My Kustomers
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
        My Kustomers Terms of Service
      </h1>
      <TermsContent />
    </main>
  );
}
