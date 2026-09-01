"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";
import type { CustomerActionState } from "@/features/customers/action-state";
import { customerFormSchema } from "@/features/customers/validation";
import { hasPossibleDuplicateCustomer } from "@/features/customers/queries";

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
  } satisfies CustomerActionState;
}

function mapCustomerError() {
  return "Customer details could not be saved. Please try again.";
}

function parseCustomerForm(formData: FormData) {
  return customerFormSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    notes: formValue(formData, "notes"),
  });
}

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { user, business } = await requireCurrentBusiness("/customers/new");
  const parsed = parseCustomerForm(formData);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const duplicate = await hasPossibleDuplicateCustomer({
    businessId: business.id,
    email: parsed.data.email,
    phone: parsed.data.phone,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: mapCustomerError(),
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "CUSTOMER_CREATED",
    metadata: { customer_id: data.id, possible_duplicate: duplicate },
  });

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  const duplicateParam = duplicate ? "?created=1&duplicate=1" : "?created=1";
  redirect(`/customers/${data.id}${duplicateParam}` as Route);
}

export async function updateCustomerAction(
  customerId: string,
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { user, business } = await requireCurrentBusiness(`/customers/${customerId}`);
  const parsed = parseCustomerForm(formData);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data: previousCustomer } = await supabase
    .from("customers")
    .select("name, email, phone, notes")
    .eq("business_id", business.id)
    .eq("id", customerId)
    .is("archived_at", null)
    .maybeSingle();

  const nextCustomer = {
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    notes: parsed.data.notes ?? null,
  };

  const { data, error } = await supabase
    .from("customers")
    .update(nextCustomer)
    .eq("business_id", business.id)
    .eq("id", customerId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: mapCustomerError(),
    };
  }

  const changedFields = previousCustomer
    ? Object.entries(nextCustomer)
        .filter(
          ([key, value]) =>
            previousCustomer[key as keyof typeof previousCustomer] !== value,
        )
        .map(([key]) => key)
    : Object.keys(nextCustomer);

  await recordAuditEvent({
    actorUserId: user.id,
    businessId: business.id,
    eventType: "CUSTOMER_UPDATED",
    metadata: { customer_id: customerId, changed_fields: changedFields },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);

  return {
    status: "success",
    message: "Customer updated.",
  };
}

export async function archiveCustomerAction(customerId: string) {
  const { user, business } = await requireCurrentBusiness(`/customers/${customerId}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("id", customerId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (!error && data) {
    await recordAuditEvent({
      actorUserId: user.id,
      businessId: business.id,
      eventType: "CUSTOMER_ARCHIVED",
      metadata: { customer_id: customerId },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  redirect("/customers" as Route);
}

export async function archiveCustomerLifecycleAction(
  customerId: string,
  _previousState: CustomerActionState,
  _formData: FormData,
): Promise<CustomerActionState> {
  void _previousState;
  void _formData;
  const { user, business } = await requireCurrentBusiness(`/customers/${customerId}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("id", customerId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: "The customer could not be archived." };
  }

  if (data) {
    await recordAuditEvent({
      actorUserId: user.id,
      businessId: business.id,
      eventType: "CUSTOMER_ARCHIVED",
      metadata: { customer_id: customerId },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return {
    status: "success",
    message: data
      ? "Customer archived. Bookings remain unchanged."
      : "Customer is already archived.",
  };
}

export async function restoreCustomerAction(
  customerId: string,
  _previousState: CustomerActionState,
  _formData: FormData,
): Promise<CustomerActionState> {
  void _previousState;
  void _formData;
  const { user, business } = await requireCurrentBusiness(`/customers/${customerId}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ archived_at: null })
    .eq("business_id", business.id)
    .eq("id", customerId)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: "The customer could not be restored." };
  }

  if (data) {
    await recordAuditEvent({
      actorUserId: user.id,
      businessId: business.id,
      eventType: "CUSTOMER_UPDATED",
      metadata: {
        customer_id: customerId,
        changed_fields: ["archived_at"],
        operation: "restored",
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return {
    status: "success",
    message: data
      ? "Customer restored to the active list."
      : "Customer is already active.",
  };
}

export async function deleteCustomerAction(
  customerId: string,
  _previousState: CustomerActionState,
  _formData: FormData,
): Promise<CustomerActionState> {
  void _previousState;
  void _formData;
  const { business } = await requireCurrentBusiness(`/customers/${customerId}`);
  const supabase = await createClient();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (customerError || !customer) {
    return { status: "error", message: "The customer could not be deleted." };
  }

  const { data, error } = await supabase.rpc("delete_customer_if_eligible", {
    p_customer_id: customerId,
  });
  const result = data?.[0];

  if (error || !result) {
    return { status: "error", message: "The customer could not be deleted." };
  }

  if (!result.deleted) {
    return {
      status: "error",
      message:
        result.reason === "booking_history_exists"
          ? "This customer has booking history and can’t be permanently deleted. Archive them instead."
          : "This customer has protected records and can’t be permanently deleted.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return { status: "success", message: "Customer permanently deleted." };
}
