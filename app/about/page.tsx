import type { Metadata } from "next";
import { AboutContent } from "@/components/legal/about-content";
import { LegalPage } from "@/components/legal/legal-page";
import { absoluteSeoUrl } from "@/lib/seo/site";
export const metadata: Metadata = {
  title: "About My Kustomers",
  description:
    "Keep every customer in the loop, from booking confirmation through delivery and feedback.",
  alternates: { canonical: absoluteSeoUrl("/about") },
};
export default function AboutPage() {
  return (
    <LegalPage title="About My Kustomers">
      <AboutContent />
    </LegalPage>
  );
}
