import { Building2 } from "lucide-react";
import Link from "next/link";

export default function AdminBusinessNotFound() {
  return (
    <section className="border border-border bg-card p-6">
      <Building2 className="size-6 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">Business not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This business is unavailable or no longer exists.
      </p>
      <Link
        href="/admin/businesses"
        className="mt-6 inline-flex font-medium text-primary"
      >
        Return to businesses
      </Link>
    </section>
  );
}
