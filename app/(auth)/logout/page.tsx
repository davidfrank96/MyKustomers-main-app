import { logoutAction } from "@/features/auth/actions";

export default function LogoutPage() {
  return (
    <main className="w-full rounded-lg border border-border bg-card p-5 shadow-sm">
      <h1 className="text-xl font-semibold">Log out</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        End this browser session for My Kustomers.
      </p>
      <form action={logoutAction} className="mt-5">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
