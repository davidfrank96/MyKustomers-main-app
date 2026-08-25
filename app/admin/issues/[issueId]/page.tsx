import { ArrowLeft, Building2, CalendarDays, UserRound } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { formatOperationLabel } from "@/features/admin/operations";
import { getAdminIssue } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Issue operations | Platform administration" };

type PageProps = { params: Promise<{ issueId: string }> };
const uuidSchema = z.string().uuid();
const dateTimeFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function identity(value: { display_name: string | null; email: string | null }) {
  if (value.display_name && value.email) return `${value.display_name} (${value.email})`;
  return value.display_name ?? value.email ?? "Account unavailable";
}

export default async function AdminIssueDetailPage({ params }: PageProps) {
  const parsedId = uuidSchema.safeParse((await params).issueId);
  if (!parsedId.success) notFound();
  const issue = await getAdminIssue(parsedId.data);
  if (!issue) notFound();

  return (
    <section aria-labelledby="admin-issue-title" className="space-y-8">
      <header className="border-b border-border pb-6">
        <Link href="/admin/issues" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" aria-hidden="true" />Issues</Link>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant={issue.status === "OPEN" ? "accent" : "outline"}>{formatOperationLabel(issue.status)}</Badge>
          <span className="text-sm font-semibold text-muted-foreground">{formatOperationLabel(issue.category)}</span>
        </div>
        <h1 id="admin-issue-title" className="mt-2 text-3xl font-semibold">Operational issue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Created {dateTimeFormatter.format(new Date(issue.created_at))} UTC</p>
      </header>

      <section aria-labelledby="issue-description-title">
        <h2 id="issue-description-title" className="text-lg font-semibold">Issue report</h2>
        <p className="mt-4 whitespace-pre-wrap break-words border-y border-border py-5 text-sm leading-7">{issue.description}</p>
      </section>

      <section aria-labelledby="issue-context-title">
        <h2 id="issue-context-title" className="text-lg font-semibold">Operational context</h2>
        <div className="mt-4 grid gap-px bg-border sm:grid-cols-2">
          <Link href={`/admin/businesses/${issue.business.id}` as Route} className="bg-card p-4 transition-colors hover:bg-muted/60">
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="size-4" aria-hidden="true" />Business</span>
            <span className="mt-2 block break-words font-medium">{issue.business.name}</span>
          </Link>
          <Link href={`/admin/bookings/${issue.booking.id}` as Route} className="bg-card p-4 transition-colors hover:bg-muted/60">
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" aria-hidden="true" />Booking</span>
            <span className="mt-2 block break-words font-medium">{issue.booking.reference} · {issue.booking.title}</span>
            <Badge variant="outline" className="mt-2">{formatOperationLabel(issue.booking.status)}</Badge>
          </Link>
        </div>
      </section>

      <section aria-labelledby="issue-actors-title">
        <h2 id="issue-actors-title" className="text-lg font-semibold">Record history</h2>
        <dl className="mt-4 grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card p-4"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="size-4" aria-hidden="true" />Reported by</dt><dd className="mt-2 break-words font-medium"><Link href={`/admin/users/${issue.creator.id}` as Route} className="text-primary">{identity(issue.creator)}</Link></dd></div>
          <div className="bg-card p-4"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="size-4" aria-hidden="true" />Resolved by</dt><dd className="mt-2 break-words font-medium">{issue.resolver ? <Link href={`/admin/users/${issue.resolver.id}` as Route} className="text-primary">{identity(issue.resolver)}</Link> : "Not resolved"}</dd>{issue.resolved_at ? <p className="mt-1 text-sm text-muted-foreground">{dateTimeFormatter.format(new Date(issue.resolved_at))} UTC</p> : null}</div>
        </dl>
      </section>
    </section>
  );
}
