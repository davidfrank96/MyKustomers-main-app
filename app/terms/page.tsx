import type { Metadata } from "next";
import { TermsContent } from "@/components/legal/terms-content";
import { absoluteSeoUrl } from "@/lib/seo/site";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using My Kustomers bookings, customer communications and business workflows.",
  alternates: { canonical: absoluteSeoUrl("/terms") },
};

export default function TermsPage() {
  return (
    <LegalPage
      title={
        <>
          My Kustomers
          <br />
          Terms of Service
        </>
      }
    >
      <TermsContent />
    </LegalPage>
  );
}
