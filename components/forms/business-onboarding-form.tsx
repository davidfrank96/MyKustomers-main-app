"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  initialBusinessActionState,
  type BusinessActionState,
} from "@/features/businesses/action-state";
import { businessCategories, slugifyBusinessSlug } from "@/features/businesses/validation";

type BusinessFormValues = {
  name?: string;
  slug?: string;
  category?: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  website?: string | null;
  addressText?: string | null;
};

type BusinessOnboardingFormProps = {
  action: (
    previousState: BusinessActionState,
    formData: FormData,
  ) => Promise<BusinessActionState>;
  mode: "create" | "edit";
  initialValues?: BusinessFormValues;
  isOwner?: boolean;
};

function fieldError(state: BusinessActionState, name: string) {
  return state.fieldErrors?.[name]?.[0];
}

function FormStatusMessage({ state }: { state: BusinessActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className="flex gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.status === "error" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      )}
      <span className="text-muted-foreground">{state.message}</span>
    </div>
  );
}

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Create business" : "Save changes";

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      {pending ? "Please wait..." : label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Button>
  );
}

export function BusinessOnboardingForm({
  action,
  mode,
  initialValues = {},
  isOwner = true,
}: BusinessOnboardingFormProps) {
  const [state, formAction] = useActionState(action, initialBusinessActionState);
  const [name, setName] = useState(initialValues.name ?? "");
  const [slug, setSlug] = useState(initialValues.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues.slug));
  const visibleSlug = slugTouched ? slug : slugifyBusinessSlug(name);

  const disabled = !isOwner;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormStatusMessage state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="organization"
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "name"))}
            aria-describedby={fieldError(state, "name") ? "name-error" : undefined}
          />
          {fieldError(state, "name") ? (
            <p id="name-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "name")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Business slug</Label>
          <Input
            id="slug"
            name="slug"
            value={visibleSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugifyBusinessSlug(event.target.value));
            }}
            inputMode="url"
            autoComplete="off"
            required
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "slug"))}
            aria-describedby={fieldError(state, "slug") ? "slug-error" : undefined}
          />
          {fieldError(state, "slug") ? (
            <p id="slug-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "slug")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select name="category" defaultValue={initialValues.category ?? ""} disabled={disabled}>
            <SelectTrigger id="category" aria-invalid={Boolean(fieldError(state, "category"))}>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {businessCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError(state, "category") ? (
            <p className="text-sm leading-5 text-destructive">{fieldError(state, "category")}</p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={initialValues.description ?? ""}
            maxLength={1000}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initialValues.phone ?? ""}
            autoComplete="tel"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "phone"))}
            aria-describedby={fieldError(state, "phone") ? "phone-error" : undefined}
          />
          {fieldError(state, "phone") ? (
            <p id="phone-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "phone")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Business email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues.email ?? ""}
            autoComplete="email"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "email"))}
            aria-describedby={fieldError(state, "email") ? "email-error" : undefined}
          />
          {fieldError(state, "email") ? (
            <p id="email-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "email")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={initialValues.whatsapp ?? ""}
            autoComplete="tel"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "whatsapp"))}
            aria-describedby={fieldError(state, "whatsapp") ? "whatsapp-error" : undefined}
          />
          {fieldError(state, "whatsapp") ? (
            <p id="whatsapp-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "whatsapp")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            name="instagram"
            defaultValue={initialValues.instagram ? `@${initialValues.instagram}` : ""}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "instagram"))}
            aria-describedby={fieldError(state, "instagram") ? "instagram-error" : undefined}
          />
          {fieldError(state, "instagram") ? (
            <p id="instagram-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "instagram")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            name="website"
            type="url"
            inputMode="url"
            placeholder="example.com"
            defaultValue={initialValues.website ?? ""}
            autoComplete="url"
            disabled={disabled}
            aria-invalid={Boolean(fieldError(state, "website"))}
            aria-describedby={fieldError(state, "website") ? "website-error" : undefined}
          />
          {fieldError(state, "website") ? (
            <p id="website-error" className="text-sm leading-5 text-destructive">
              {fieldError(state, "website")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="addressText">Address</Label>
          <Textarea
            id="addressText"
            name="addressText"
            defaultValue={initialValues.addressText ?? ""}
            maxLength={500}
            disabled={disabled}
          />
          {fieldError(state, "addressText") ? (
            <p className="text-sm leading-5 text-destructive">
              {fieldError(state, "addressText")}
            </p>
          ) : null}
        </div>
      </div>

      {isOwner ? <SubmitButton mode={mode} /> : null}
    </form>
  );
}
