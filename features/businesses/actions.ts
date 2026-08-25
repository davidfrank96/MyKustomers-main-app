"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  getCurrentBusinessContext,
  requireBusinessRole,
  requireUser,
} from "@/lib/auth/server";
import { setSelectedBusinessId } from "@/lib/auth/current-business";
import { recordAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";
import type { BusinessActionState } from "@/features/businesses/action-state";
import { businessProfileSchema } from "@/features/businesses/validation";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import {
  clearPendingBusinessOnboardingId,
  getPendingBusinessOnboardingId,
  setPendingBusinessOnboardingId,
} from "@/features/businesses/pending-onboarding";
import {
  isBusinessOnboardingPending,
  PENDING_BUSINESS_ONBOARDING_TIMESTAMP,
} from "@/features/businesses/onboarding";

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  } satisfies BusinessActionState;
}

function mapBusinessError(message?: string) {
  const safeMessage = message?.toLowerCase() ?? "";

  if (safeMessage.includes("duplicate") || safeMessage.includes("slug_unavailable")) {
    return "That business slug is already in use. Try a more specific slug.";
  }

  if (safeMessage.includes("invalid_business")) {
    return "Check the highlighted fields and try again.";
  }

  return "Business details could not be saved. Please try again.";
}

function parseBusinessForm(formData: FormData) {
  return businessProfileSchema.safeParse({
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    category: formValue(formData, "category"),
    description: formValue(formData, "description"),
    phone: formValue(formData, "phone"),
    email: formValue(formData, "email"),
    whatsapp: formValue(formData, "whatsapp"),
    instagram: formValue(formData, "instagram"),
    website: formValue(formData, "website"),
    addressText: formValue(formData, "addressText"),
  });
}

async function createBusiness(formData: FormData): Promise<BusinessActionState | string> {
  if (formValue(formData, "logoSelected") !== "true") {
    return {
      status: "error",
      message: "Add a business logo before creating your business.",
      fieldErrors: { logo: ["Choose a business logo."] },
    };
  }

  const parsed = parseBusinessForm(formData);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_business_onboarding", {
    business_name: parsed.data.name,
    business_slug: parsed.data.slug,
    business_category: parsed.data.category,
    business_description: parsed.data.description ?? null,
    business_phone: parsed.data.phone ?? null,
    business_email: parsed.data.email ?? null,
    business_whatsapp: parsed.data.whatsapp ?? null,
    business_instagram: parsed.data.instagram ?? null,
    business_address_text: parsed.data.addressText ?? null,
    business_website: parsed.data.website ?? null,
  });

  if (error || !data) {
    return {
      status: "error",
      message: mapBusinessError(error?.message),
    };
  }

  return data;
}

function pendingBusinessState(business: {
  id: string;
  name: string;
  logoPath: string | null;
}): BusinessActionState {
  return {
    status: "logo_required",
    message: business.logoPath
      ? "Logo saved. Finishing business setup…"
      : "Business details saved. Upload the required logo to finish setup.",
    pendingBusiness: {
      id: business.id,
      name: business.name,
      logoUrl: getBusinessLogoPublicUrl(business.logoPath),
    },
  };
}

async function markBusinessOnboardingPending(businessId: string) {
  const supabase = await createClient();
  await supabase
    .from("businesses")
    .update({ onboarding_completed_at: PENDING_BUSINESS_ONBOARDING_TIMESTAMP })
    .eq("id", businessId);
}

function findPendingBusiness(
  context: Awaited<ReturnType<typeof getCurrentBusinessContext>>,
  pendingBusinessId: string | null,
) {
  return (
    context.pendingBusinesses.find(
      (business) => business.id === pendingBusinessId && business.role === "owner",
    ) ?? context.pendingBusinesses.find((business) => business.role === "owner")
  );
}

export async function createBusinessAction(
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const user = await requireUser("/onboarding");

  const existingContext = await getCurrentBusinessContext(user);
  const pendingBusinessId = await getPendingBusinessOnboardingId();
  const pendingBusiness = findPendingBusiness(existingContext, pendingBusinessId);

  if (pendingBusiness) {
    return pendingBusinessState(pendingBusiness);
  }

  if (existingContext.currentBusiness) {
    redirect("/dashboard" as Route);
  }

  const result = await createBusiness(formData);
  if (typeof result !== "string") {
    return result;
  }

  await markBusinessOnboardingPending(result);
  await setPendingBusinessOnboardingId(result);

  return pendingBusinessState({
    id: result,
    name: parsedBusinessName(formData),
    logoPath: null,
  });
}

export async function createAdditionalBusinessAction(
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const user = await requireUser("/business/new");
  const existingContext = await getCurrentBusinessContext(user);
  const pendingBusinessId = await getPendingBusinessOnboardingId();
  const pendingBusiness = findPendingBusiness(existingContext, pendingBusinessId);

  if (pendingBusiness) {
    return pendingBusinessState(pendingBusiness);
  }

  if (!existingContext.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  const result = await createBusiness(formData);
  if (typeof result !== "string") {
    return result;
  }

  await markBusinessOnboardingPending(result);
  await setPendingBusinessOnboardingId(result);

  return pendingBusinessState({
    id: result,
    name: parsedBusinessName(formData),
    logoPath: null,
  });
}

function parsedBusinessName(formData: FormData) {
  const name = formValue(formData, "name");
  return typeof name === "string" && name.trim() ? name.trim() : "New business";
}

export async function completeBusinessOnboardingAction(
  businessId: string,
): Promise<BusinessActionState> {
  const user = await requireUser("/onboarding");
  await requireBusinessRole(businessId, ["owner"], user);
  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("logo_path, onboarding_completed_at")
    .eq("id", businessId)
    .maybeSingle();

  if (
    error ||
    !business?.logo_path ||
    !isBusinessOnboardingPending(business.onboarding_completed_at)
  ) {
    return {
      status: "error",
      message: "This business setup cannot be finalized. Refresh and try again.",
    };
  }

  const { error: completionError } = await supabase
    .from("businesses")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", businessId);

  if (completionError) {
    return {
      status: "error",
      message: "Business setup could not be finalized. Please try again.",
    };
  }

  await setSelectedBusinessId(businessId);
  await clearPendingBusinessOnboardingId();
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: "Business setup complete.",
  };
}

export async function updateBusinessProfileAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const user = await requireUser("/business");
  await requireBusinessRole(businessId, ["owner"], user);

  const parsed = parseBusinessForm(formData);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data: previousBusiness } = await supabase
    .from("businesses")
    .select(
      "name, slug, category, description, phone, email, whatsapp, instagram, website, address_text",
    )
    .eq("id", businessId)
    .maybeSingle();

  const nextBusiness = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    category: parsed.data.category,
    description: parsed.data.description ?? null,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    whatsapp: parsed.data.whatsapp ?? null,
    instagram: parsed.data.instagram ?? null,
    website: parsed.data.website ?? null,
    address_text: parsed.data.addressText ?? null,
  };

  const { error } = await supabase
    .from("businesses")
    .update(nextBusiness)
    .eq("id", businessId);

  if (error) {
    return {
      status: "error",
      message: mapBusinessError(error.message),
    };
  }

  const changedFields = previousBusiness
    ? Object.entries(nextBusiness)
        .filter(
          ([key, value]) =>
            previousBusiness[key as keyof typeof previousBusiness] !== value,
        )
        .map(([key]) => key)
    : Object.keys(nextBusiness);

  await recordAuditEvent({
    actorUserId: user.id,
    businessId,
    eventType: "BUSINESS_UPDATED",
    metadata: { changed_fields: changedFields },
  });

  revalidatePath("/dashboard");
  revalidatePath("/business");

  return {
    status: "success",
    message: "Business profile updated.",
  };
}
