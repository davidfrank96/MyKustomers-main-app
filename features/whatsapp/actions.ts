"use server";
import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function disableBookingWhatsApp(bookingId: string) {
  if (!z.string().uuid().safeParse(bookingId).success) return;
  const { business } = await requireCurrentBusiness(`/bookings/${bookingId}`);
  const db = await createClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!booking) return;
  const { error } = await db.rpc("disable_booking_whatsapp", { p_booking_id: bookingId });
  if (error) throw new Error("WhatsApp updates could not be stopped. Please try again.");
  revalidatePath(`/bookings/${bookingId}`);
}
