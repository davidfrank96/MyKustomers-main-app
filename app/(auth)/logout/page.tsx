import { LogoutForm } from "@/components/notifications/logout-form";
export default async function LogoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="w-full rounded-lg border border-border bg-card p-5 shadow-sm">
      <h1 className="text-xl font-semibold">Log out</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        End this browser session for My Kustomers and disconnect its push notifications.
      </p>
      {params["notification-error"] ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          We couldn’t disconnect this device’s notifications. Check your connection and
          try logging out again.
        </p>
      ) : null}
      <div className="mt-5">
        <LogoutForm />
      </div>
    </main>
  );
}
