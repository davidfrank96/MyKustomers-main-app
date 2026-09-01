import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import { BookingDetailSection } from "@/components/bookings/booking-detail-section";
import {
  BookingIssueForm,
  BookingIssueResolveForm,
} from "@/components/forms/booking-issue-form";
import { Badge } from "@/components/ui/badge";
import type { IssueActionState } from "@/features/feedback/action-state";
import type { BookingIssue } from "@/features/feedback/queries";
import { issueCategoryLabels } from "@/features/feedback/validation";

type BookingIssuesPanelProps = {
  issues: BookingIssue[];
  createAction: (
    previousState: IssueActionState,
    formData: FormData,
  ) => Promise<IssueActionState>;
  resolveAction: (issueId: string, status: string) => Promise<void>;
};

function formatIssueDateTime(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getBookingIssuesSummary(issues: BookingIssue[]) {
  const openIssueCount = issues.filter((issue) => issue.status === "OPEN").length;

  if (openIssueCount > 0) {
    return `${openIssueCount} open issue${openIssueCount === 1 ? "" : "s"}`;
  }

  return issues.length > 0 ? "No open issues" : "No issues recorded";
}

export function BookingIssuesPanel({
  issues,
  createAction,
  resolveAction,
}: BookingIssuesPanelProps) {
  const openIssueCount = issues.filter((issue) => issue.status === "OPEN").length;

  return (
    <BookingDetailSection
      id="operational-issues"
      title="Operational issues"
      summary={getBookingIssuesSummary(issues)}
      attention={openIssueCount > 0}
      icon="issues"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/[0.035] p-3 text-sm leading-6 text-foreground">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary">
            <Info className="size-4" aria-hidden="true" />
          </span>
          <p className="pt-1">Log any problem that impacted this booking.</p>
        </div>

        <BookingIssueForm action={createAction} />

        <div className="border-t border-border pt-5">
          {issues.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary">
                <ClipboardCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">No issues recorded.</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                  Everything looks good so far.
                </p>
              </div>
            </div>
          ) : (
            <ol className="space-y-3" aria-label="Recorded operational issues">
              {issues.map((issue) => {
                const isOpen = issue.status === "OPEN";

                return (
                  <li
                    key={issue.id}
                    className="rounded-lg border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(23,33,29,0.04)]"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          isOpen
                            ? "grid size-9 shrink-0 place-items-center rounded-full bg-destructive/[0.08] text-destructive"
                            : "grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.07] text-primary"
                        }
                      >
                        {isOpen ? (
                          <TriangleAlert className="size-[1.125rem]" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="size-[1.125rem]" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold leading-5">
                            {issueCategoryLabels[issue.category]}
                          </p>
                          <Badge
                            variant={isOpen ? "accent" : "outline"}
                            className={
                              isOpen
                                ? "bg-destructive/[0.08] text-destructive"
                                : "border-primary/15 bg-primary/[0.05] text-primary"
                            }
                          >
                            {isOpen ? "Open" : "Resolved"}
                          </Badge>
                        </div>
                        <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                          {issue.description}
                        </p>
                        <div className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                          <CalendarDays
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <p>
                            Created {formatIssueDateTime(issue.created_at)}
                            {issue.resolved_at ? (
                              <span className="block sm:inline">
                                <span className="hidden sm:inline"> · </span>
                                Resolved {formatIssueDateTime(issue.resolved_at)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        {isOpen ? (
                          <div className="mt-3">
                            <BookingIssueResolveForm
                              action={resolveAction.bind(null, issue.id, issue.status)}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </BookingDetailSection>
  );
}
