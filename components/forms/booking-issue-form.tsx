"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending}>
      <AlertCircle className="size-4" aria-hidden="true" />
      {pending ? "Creating..." : "Create issue"}
    </Button>
  );
}

export function BookingIssueForm({ action }: BookingIssueFormProps) {
  const [state, formAction] = useActionState(action, initialIssueActionState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="issue-category" className="text-sm font-medium">
          Category
        </label>
        <select
          id="issue-category"
          name="category"
          required
          className="min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">Choose a category</option>
          {issueCategories.map((category) => (
            <option key={category} value={category}>
              {issueCategoryLabels[category]}
            </option>
          ))}
        </select>
        {state.fieldErrors?.category ? (
          <p className="text-sm text-destructive">{state.fieldErrors.category[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="issue-description" className="text-sm font-medium">
          Issue description
        </label>
        <Textarea
          id="issue-description"
          name="description"
          required
          maxLength={2000}
          placeholder="Record the operational problem."
        />
        {state.fieldErrors?.description ? (
          <p className="text-sm text-destructive">{state.fieldErrors.description[0]}</p>
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

      <SubmitButton />
    </form>
  );
}
