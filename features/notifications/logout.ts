import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PUSH_DEVICE_COOKIE } from "@/features/notifications/contracts";
export async function disconnectNotificationDevice() {
  const cookieStore = await cookies();
  const id = z.string().uuid().safeParse(cookieStore.get(PUSH_DEVICE_COOKIE)?.value);
  if (!id.success) return true;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return false;
  const { error } = await supabase.rpc("remove_push_subscription", {
    p_subscription_id: id.data,
  });
  if (error) return false;
  cookieStore.delete(PUSH_DEVICE_COOKIE);
  return true;
}
