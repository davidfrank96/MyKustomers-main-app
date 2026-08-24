import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform administration",
};

export default function AdminPage() {
  return (
    <section aria-labelledby="admin-overview-title">
      <p className="text-sm font-semibold text-primary">Platform Operations</p>
      <h1 id="admin-overview-title" className="mt-2 text-3xl font-semibold">
        Administration overview
      </h1>
      <div className="mt-8 border-l-4 border-primary bg-card px-5 py-4">
        <p className="font-medium">System: Admin access verified</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform administration is available to this account.
        </p>
      </div>
    </section>
  );
}
