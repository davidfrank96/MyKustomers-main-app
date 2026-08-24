import Link from "next/link";
import type { Route } from "next";
import { BriefcaseBusiness, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logoutAction } from "@/features/auth/actions";
import { getCurrentBusinessContext, requireUser } from "@/lib/auth/server";

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const context = await getCurrentBusinessContext();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">Account</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Settings</h1>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
            {user.email ?? "Signed-in account"}
          </p>
        </div>
      </section>

      {context.currentBusiness ? (
        <Card>
          <CardHeader>
            <CardTitle>Business settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full sm:w-fit">
              <Link href={"/business" as Route}>
                <BriefcaseBusiness className="size-4" aria-hidden="true" />
                Open business profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" className="w-full sm:w-fit">
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
