import { UserRoundX } from "lucide-react";
import Link from "next/link";

export default function AdminUserNotFound() {
  return (
    <section className="border border-border bg-card p-6">
      <UserRoundX className="size-6 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">User not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This account is unavailable or no longer exists.
      </p>
      <Link href="/admin/users" className="mt-6 inline-flex font-medium text-primary">
        Return to users
      </Link>
    </section>
  );
}
