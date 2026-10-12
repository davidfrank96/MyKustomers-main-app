import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LegalBackLink } from "@/components/legal/legal-back-link";
export function LegalPage({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
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
        {title}
      </h1>
      {children}
    </main>
  );
}
