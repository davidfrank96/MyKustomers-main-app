"use client";
import { logoutAction } from "@/features/auth/actions";
import { updateAppBadge } from "@/features/notifications/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
export function LogoutForm() {
  async function logout() {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
      }
      await updateAppBadge(0);
    } catch {
      /* Server-side device revocation is still required before sign-out. */
    }
    await logoutAction();
  }
  return (
    <form action={logout}>
      <Button type="submit" variant="secondary" className="w-full sm:w-fit">
        <LogOut className="size-4" aria-hidden="true" />
        Log out
      </Button>
    </form>
  );
}
