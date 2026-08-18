import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center px-5 py-8">
      {children}
    </main>
  );
}
