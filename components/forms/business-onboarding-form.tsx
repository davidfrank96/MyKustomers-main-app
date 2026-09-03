"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Instagram,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MessageCircleMore,
  Phone,
  Store,
} from "lucide-react";
import { BusinessLogoForm } from "@/components/forms/business-logo-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  initialBusinessActionState,
  type BusinessActionState,
} from "@/features/businesses/action-state";
import {
  businessCategories,
  slugifyBusinessSlug,
} from "@/features/businesses/validation";

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

export type BusinessEditSection = "information" | "contact" | "address";

type BusinessOnboardingFormProps = {
  action: (
    previousState: BusinessActionState,
    formData: FormData,
  ) => Promise<BusinessActionState>;
  mode: "create" | "edit";
  initialValues?: BusinessFormValues;
  isOwner?: boolean;
  initialState?: BusinessActionState;
  completeAction?: (businessId: string) => Promise<BusinessActionState>;
  sectionedEdit?: boolean;
  activeEditSection?: BusinessEditSection | null;
  onEditSectionChange?: (section: BusinessEditSection) => void;
  editLogo?: {
    businessId: string;
    businessName: string;
    currentLogoUrl: string | null;
  };
};

function BusinessEditSectionRow({
  section,
  title,
  description,
  icon: Icon,
  open,
  onOpen,
  children,
}: {
  section: BusinessEditSection;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  open: boolean;
  onOpen: (section: BusinessEditSection) => void;
  children: ReactNode;
}) {
  const contentId = `business-${section}-content`;

  return (
    <section id={`business-${section}`} className="scroll-mt-24">
      <button
        type="button"
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onOpen(section)}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <Icon className="size-5" aria-hidden={true} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
        <ChevronRight
          className={`size-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      <div id={contentId} hidden={!open} className="border-t border-border p-4">
        {children}
      </div>
    </section>
  );
}

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
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
      )}
      <span className="text-muted-foreground">{state.message}</span>
    </div>
  );
}

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}{" "}
      <span className="text-destructive" aria-hidden="true">
        *
      </span>
    </Label>
  );
}

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Create business" : "Save changes";

  return (
    <Button
      type="submit"
      disabled={pending}
      size={mode === "create" ? "lg" : "md"}
      className={
        mode === "create" ? "w-full text-base disabled:opacity-100" : "w-full sm:w-fit"
      }
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : mode === "create" ? (
        <Store className="size-4" aria-hidden="true" />
      ) : null}
      <span>{pending ? "Please wait..." : label}</span>
      {!pending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
    </Button>
  );
}

export function BusinessOnboardingForm({
  action,
  mode,
  initialValues = {},
  isOwner = true,
  initialState = initialBusinessActionState,
  completeAction,
  sectionedEdit = false,
  activeEditSection = null,
  onEditSectionChange,
  editLogo,
}: BusinessOnboardingFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);
  const [finalizing, startFinalizing] = useTransition();
  const [name, setName] = useState(initialValues.name ?? "");
  const [slug, setSlug] = useState(initialValues.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues.slug));
  const [logoSelected, setLogoSelected] = useState(false);
  const generatedLogoInputId = useId();
  const logoInputId = `business-logo-${generatedLogoInputId}`;
  const [logoError, setLogoError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const visibleSlug = slugTouched ? slug : slugifyBusinessSlug(name);
  const pendingBusiness = state.pendingBusiness;

  const disabled = !isOwner || Boolean(pendingBusiness);

  useEffect(() => {
    if (!sectionedEdit || !state.fieldErrors || !onEditSectionChange) return;

    const fields = Object.keys(state.fieldErrors);
    let targetSection: BusinessEditSection | null = null;
    if (
      fields.some((field) => ["name", "slug", "category", "description"].includes(field))
    ) {
      targetSection = "information";
    } else if (
      fields.some((field) =>
        ["phone", "email", "whatsapp", "instagram", "website"].includes(field),
      )
    ) {
      targetSection = "contact";
    } else if (fields.includes("addressText")) {
      targetSection = "address";
    }

    if (targetSection && targetSection !== activeEditSection) {
      onEditSectionChange(targetSection);
    }
  }, [activeEditSection, onEditSectionChange, sectionedEdit, state.fieldErrors]);

  const finishSetup = useCallback(() => {
    if (!pendingBusiness || !completeAction || finalizing) {
      return;
    }

    setCompletionError(null);
    startFinalizing(async () => {
      const result = await completeAction(pendingBusiness.id);
      if (result.status === "success") {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setCompletionError(result.message ?? "Business setup could not be completed.");
    });
  }, [completeAction, finalizing, pendingBusiness, router]);

  const informationFields = (
    <>
      {sectionedEdit && mode === "edit" ? (
        <input type="hidden" name="slug" value={visibleSlug} />
      ) : null}
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

      {!sectionedEdit || mode !== "edit" ? (
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
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          name="category"
          defaultValue={initialValues.category ?? ""}
          disabled={disabled}
        >
          <SelectTrigger
            id="category"
            aria-invalid={Boolean(fieldError(state, "category"))}
          >
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
          <p className="text-sm leading-5 text-destructive">
            {fieldError(state, "category")}
          </p>
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
    </>
  );

  const contactFields = (
    <>
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
          aria-describedby={
            fieldError(state, "instagram") ? "instagram-error" : undefined
          }
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
    </>
  );

  const addressFields = (
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
  );

  return (
    <form
      action={formAction}
      className="space-y-5 sm:space-y-6"
      noValidate
      onSubmit={(event) => {
        if (mode === "create" && !pendingBusiness && !logoSelected) {
          event.preventDefault();
          setLogoError("Choose a business logo before creating your business.");
          document.getElementById(logoInputId)?.focus();
        }
      }}
    >
      {mode === "create" ? (
        <header className="flex items-start gap-3 sm:gap-4">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:size-14"
            aria-hidden="true"
          >
            <Store className="size-6 sm:size-7" aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-lg font-semibold leading-6 sm:text-xl">
              Business profile
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground sm:leading-6">
              Add your business details. This information helps your customers recognize
              and trust your brand.
            </p>
          </div>
        </header>
      ) : null}

      <FormStatusMessage state={state} />

      {mode === "create" ? (
        <section
          className="space-y-4 border-b border-border pb-5 sm:pb-6"
          aria-labelledby="business-logo-heading"
        >
          <div>
            <h3 id="business-logo-heading" className="text-sm font-semibold sm:text-base">
              Business logo{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground sm:leading-6">
              Upload your logo so customers can recognize your business when you send
              booking confirmations.
            </p>
          </div>
          <BusinessLogoForm
            businessId={pendingBusiness?.id ?? null}
            businessName={pendingBusiness?.name ?? (name.trim() || "Your business")}
            currentLogoUrl={pendingBusiness?.logoUrl ?? null}
            isOwner={isOwner}
            mode="onboarding"
            inputId={logoInputId}
            onSelectionChange={(selected) => {
              setLogoSelected(selected);
              if (selected) setLogoError(null);
            }}
            onPersisted={finishSetup}
          />
          <input
            type="hidden"
            name="logoSelected"
            value={logoSelected ? "true" : "false"}
          />
          {logoError ? (
            <p className="text-sm text-destructive" role="alert">
              {logoError}
            </p>
          ) : null}
          {finalizing ? (
            <p className="text-sm text-muted-foreground" role="status">
              Finishing business setup…
            </p>
          ) : null}
          {completionError ? (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">{completionError}</p>
              <Button type="button" variant="secondary" onClick={finishSetup}>
                Finish setup
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {sectionedEdit && mode === "edit" && onEditSectionChange ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <BusinessEditSectionRow
            section="information"
            title="Business information"
            description="Name, category, description, logo"
            icon={Building2}
            open={activeEditSection === "information"}
            onOpen={onEditSectionChange}
          >
            <div className="space-y-5">
              {editLogo ? (
                <BusinessLogoForm
                  businessId={editLogo.businessId}
                  businessName={editLogo.businessName}
                  currentLogoUrl={editLogo.currentLogoUrl}
                  isOwner={isOwner}
                />
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">{informationFields}</div>
            </div>
          </BusinessEditSectionRow>
          <BusinessEditSectionRow
            section="contact"
            title="Contact information"
            description="Phone, email, WhatsApp, Instagram, website"
            icon={Phone}
            open={activeEditSection === "contact"}
            onOpen={onEditSectionChange}
          >
            <div className="grid gap-4 md:grid-cols-2">{contactFields}</div>
          </BusinessEditSectionRow>
          <BusinessEditSectionRow
            section="address"
            title="Business address"
            description="Manage your business location"
            icon={MapPin}
            open={activeEditSection === "address"}
            onOpen={onEditSectionChange}
          >
            <div className="grid gap-4 md:grid-cols-2">{addressFields}</div>
          </BusinessEditSectionRow>
        </div>
      ) : null}

      {!sectionedEdit || mode !== "edit" ? (
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <RequiredLabel htmlFor="name">Business name</RequiredLabel>
            <Input
              id="name"
              name="name"
              placeholder="Enter your business name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="organization"
              required
              disabled={disabled}
              className="text-base sm:text-sm"
              aria-invalid={Boolean(fieldError(state, "name"))}
              aria-describedby={fieldError(state, "name") ? "name-error" : undefined}
            />
            {fieldError(state, "name") ? (
              <p id="name-error" className="text-sm leading-5 text-destructive">
                {fieldError(state, "name")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel htmlFor="slug">Business slug</RequiredLabel>
            <Input
              id="slug"
              name="slug"
              placeholder="Enter a short unique name (e.g., bright-cleaning)"
              value={visibleSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugifyBusinessSlug(event.target.value));
              }}
              inputMode="url"
              autoComplete="off"
              required
              disabled={disabled}
              className="text-base sm:text-sm"
              aria-invalid={Boolean(fieldError(state, "slug"))}
              aria-describedby={fieldError(state, "slug") ? "slug-error" : undefined}
            />
            {fieldError(state, "slug") ? (
              <p id="slug-error" className="text-sm leading-5 text-destructive">
                {fieldError(state, "slug")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel htmlFor="category">Category</RequiredLabel>
            <Select
              name="category"
              defaultValue={initialValues.category ?? ""}
              disabled={disabled}
            >
              <SelectTrigger
                id="category"
                className="text-base sm:text-sm"
                aria-required="true"
                aria-invalid={Boolean(fieldError(state, "category"))}
              >
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
              <p className="text-sm leading-5 text-destructive">
                {fieldError(state, "category")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe your business and the services you offer"
              defaultValue={initialValues.description ?? ""}
              maxLength={1000}
              disabled={disabled}
              className="min-h-24 text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Enter phone number"
              defaultValue={initialValues.phone ?? ""}
              autoComplete="tel"
              disabled={disabled}
              className="text-base sm:text-sm"
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
              placeholder="Enter business email"
              defaultValue={initialValues.email ?? ""}
              autoComplete="email"
              disabled={disabled}
              className="text-base sm:text-sm"
              aria-invalid={Boolean(fieldError(state, "email"))}
              aria-describedby={fieldError(state, "email") ? "email-error" : undefined}
            />
            {fieldError(state, "email") ? (
              <p id="email-error" className="text-sm leading-5 text-destructive">
                {fieldError(state, "email")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <div className="relative">
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                placeholder="Enter WhatsApp number (optional)"
                defaultValue={initialValues.whatsapp ?? ""}
                autoComplete="tel"
                disabled={disabled}
                className="pr-10 text-base sm:text-sm"
                aria-invalid={Boolean(fieldError(state, "whatsapp"))}
                aria-describedby={
                  fieldError(state, "whatsapp") ? "whatsapp-error" : undefined
                }
              />
              <MessageCircleMore
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
            </div>
            {fieldError(state, "whatsapp") ? (
              <p id="whatsapp-error" className="text-sm leading-5 text-destructive">
                {fieldError(state, "whatsapp")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="instagram">Instagram</Label>
            <div className="relative">
              <Input
                id="instagram"
                name="instagram"
                placeholder="Enter Instagram handle (optional)"
                defaultValue={
                  initialValues.instagram ? `@${initialValues.instagram}` : ""
                }
                autoComplete="off"
                disabled={disabled}
                className="pr-10 text-base sm:text-sm"
                aria-invalid={Boolean(fieldError(state, "instagram"))}
                aria-describedby={
                  fieldError(state, "instagram") ? "instagram-error" : undefined
                }
              />
              <Instagram
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            {fieldError(state, "instagram") ? (
              <p id="instagram-error" className="text-sm leading-5 text-destructive">
                {fieldError(state, "instagram")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website">Website</Label>
            <div className="relative">
              <Input
                id="website"
                name="website"
                type="url"
                inputMode="url"
                placeholder="example.com"
                defaultValue={initialValues.website ?? ""}
                autoComplete="url"
                disabled={disabled}
                className="pr-10 text-base sm:text-sm"
                aria-invalid={Boolean(fieldError(state, "website"))}
                aria-describedby={
                  fieldError(state, "website") ? "website-error" : undefined
                }
              />
              <Globe2
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
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
              placeholder="Enter your business address"
              defaultValue={initialValues.addressText ?? ""}
              maxLength={500}
              disabled={disabled}
              className="min-h-24 text-base sm:text-sm"
            />
            {fieldError(state, "addressText") ? (
              <p className="text-sm leading-5 text-destructive">
                {fieldError(state, "addressText")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isOwner &&
      !pendingBusiness &&
      (!sectionedEdit || mode !== "edit" || activeEditSection) ? (
        <SubmitButton mode={mode} />
      ) : null}

      {mode === "create" ? (
        <p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-muted-foreground sm:text-sm">
          <LockKeyhole className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Your business &amp; customer data are protected and private.</span>
        </p>
      ) : null}
    </form>
  );
}
