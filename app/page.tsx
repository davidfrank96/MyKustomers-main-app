import Link from "next/link";
import { AppFrame } from "@/components/layout/app-frame";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <AppFrame>
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="My Customers home">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
              MC
            </span>
            <span className="text-base font-semibold">My Customers</span>
          </Link>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Shell Preview</Link>
          </Button>
        </header>

        <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-accent">Phase 1 foundation</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              My Customers
            </h1>
            <p className="mt-5 text-xl leading-8 text-muted-foreground">
              Your customers. Your orders. Your business.
            </p>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              A mobile-first application foundation for small businesses that need a
              structured way to manage customer agreements. Product workflows are
              intentionally deferred until later phases.
            </p>
          </div>

          <aside
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
            aria-label="Foundation scope"
          >
            <h2 className="text-lg font-semibold">Foundation scope</h2>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
              <li>Responsive public and authenticated application shells.</li>
              <li>Shared design primitives prepared for real feature work.</li>
              <li>Typed environment and Supabase integration boundaries.</li>
              <li>Testing, linting, security, and architecture documentation.</li>
            </ul>
          </aside>
        </section>
      </main>
    </AppFrame>
  );
}
