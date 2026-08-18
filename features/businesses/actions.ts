"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentBusinessContext, requireBusinessRole, requireUser } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";
import type { BusinessActionState } from "@/features/businesses/action-state";
import { businessProfileSchema } from "@/features/businesses/validation";

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
    addressText: formValue(formData, "addressText"),
  });
}

export async function createBusinessAction(
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  await requireUser("/onboarding");

  const existingContext = await getCurrentBusinessContext();
  if (existingContext.currentBusiness) {
    redirect("/dashboard" as Route);
  }

  const parsed = parseBusinessForm(formData);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business_onboarding", {
    business_name: parsed.data.name,
    business_slug: parsed.data.slug,
    business_category: parsed.data.category,
    business_description: parsed.data.description ?? null,
    business_phone: parsed.data.phone ?? null,
    business_email: parsed.data.email ?? null,
    business_whatsapp: parsed.data.whatsapp ?? null,
    business_instagram: parsed.data.instagram ?? null,
    business_address_text: parsed.data.addressText ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: mapBusinessError(error.message),
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/business");
  redirect("/dashboard" as Route);
}

export async function updateBusinessProfileAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const user = await requireUser("/business");
  await requireBusinessRole(businessId, ["owner"]);

  const parsed = parseBusinessForm(formData);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data: previousBusiness } = await supabase
    .from("businesses")
    .select("name, slug, category, description, phone, email, whatsapp, instagram, address_text")
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
        .filter(([key, value]) => previousBusiness[key as keyof typeof previousBusiness] !== value)
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
