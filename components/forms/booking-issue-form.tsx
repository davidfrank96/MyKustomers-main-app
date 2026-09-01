"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FilePenLine,
  ListFilter,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  initialIssueActionState,
  type IssueActionState,
} from "@/features/feedback/action-state";
import { issueCategories, issueCategoryLabels } from "@/features/feedback/validation";

type BookingIssueFormProps = {
  action: (
    previousState: IssueActionState,
    formData: FormData,
  ) => Promise<IssueActionState>;
};

type BookingIssueResolveFormProps = {
  action: () => Promise<void>;
};

const issueDescriptionMaxLength = 2000;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <AlertCircle className="size-4" aria-hidden="true" />
      )}
      {pending ? "Creating..." : "Create issue"}
    </Button>
  );
}

export function BookingIssueForm({ action }: BookingIssueFormProps) {
  const [state, formAction] = useActionState(action, initialIssueActionState);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const categoryErrorId = "issue-category-error";
  const descriptionErrorId = "issue-description-error";

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="issue-category" className="text-sm font-semibold">
          Category
        </label>
        <div className="relative">
          <ListFilter
            className="pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
          <select
            id="issue-category"
            name="category"
            required
            aria-invalid={Boolean(state.fieldErrors?.category)}
            aria-describedby={state.fieldErrors?.category ? categoryErrorId : undefined}
            className="min-h-11 w-full appearance-none rounded-md border border-border bg-card py-2 pl-10 pr-10 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">Choose a category</option>
            {issueCategories.map((category) => (
              <option key={category} value={category}>
                {issueCategoryLabels[category]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        {state.fieldErrors?.category ? (
          <p id={categoryErrorId} className="text-sm text-destructive">
            {state.fieldErrors.category[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="issue-description" className="text-sm font-semibold">
          Issue description
        </label>
        <div className="relative">
          <FilePenLine
            className="pointer-events-none absolute left-3 top-3 size-[1.125rem] text-primary"
            aria-hidden="true"
          />
          <Textarea
            id="issue-description"
            name="description"
            required
            maxLength={issueDescriptionMaxLength}
            placeholder="Record the operational problem."
            aria-invalid={Boolean(state.fieldErrors?.description)}
            aria-describedby={
              state.fieldErrors?.description
                ? descriptionErrorId
                : "issue-description-count"
            }
            className="min-h-28 resize-y pb-8 pl-10 pr-3 pt-2.5 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            onChange={(event) => setDescriptionLength(event.currentTarget.value.length)}
          />
          <span
            id="issue-description-count"
            className="pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums text-muted-foreground"
          >
            {descriptionLength}/{issueDescriptionMaxLength}
          </span>
        </div>
        {state.fieldErrors?.description ? (
          <p id={descriptionErrorId} className="text-sm text-destructive">
            {state.fieldErrors.description[0]}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {state.message}
        </p>
      ) : null}

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}

function ResolveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4" aria-hidden="true" />
      )}
      {pending ? "Resolving..." : "Resolve issue"}
    </Button>
  );
}

export function BookingIssueResolveForm({ action }: BookingIssueResolveFormProps) {
  return (
    <form action={action}>
      <ResolveButton />
    </form>
  );
}
