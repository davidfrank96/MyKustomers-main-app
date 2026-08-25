import { CircleAlert } from "lucide-react";
import Link from "next/link";

export default function AdminIssueNotFound() {
  return <section className="border border-border bg-card p-6"><CircleAlert className="size-6 text-muted-foreground" aria-hidden="true" /><h1 className="mt-4 text-2xl font-semibold">Issue not found</h1><p className="mt-2 text-sm text-muted-foreground">This issue is unavailable or no longer exists.</p><Link href="/admin/issues" className="mt-6 inline-flex font-medium text-primary">Return to issues</Link></section>;
}
