"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { setSelectedBusinessId } from "@/lib/auth/current-business";
import { getBusinessMemberships, requireUser } from "@/lib/auth/server";

const businessIdSchema = z.string().uuid();

export async function switchCurrentBusinessAction(formData: FormData) {
  const user = await requireUser("/dashboard");
  const parsedBusinessId = businessIdSchema.safeParse(formData.get("businessId"));

  if (!parsedBusinessId.success) {
    redirect("/dashboard?business=unavailable" as Route);
  }

  const memberships = await getBusinessMemberships(user);
  const membership = memberships.find(
    (candidate) => candidate.businessId === parsedBusinessId.data,
  );

  if (!membership) {
    redirect("/dashboard?business=unavailable" as Route);
  }

  await setSelectedBusinessId(membership.businessId);
  revalidatePath("/", "layout");
  redirect("/dashboard" as Route);
}
