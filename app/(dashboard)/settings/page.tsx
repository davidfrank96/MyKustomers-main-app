import Link from "next/link";
import type { Route } from "next";
import { BriefcaseBusiness, LogOut } from "lucide-react";
import { BusinessMembershipList } from "@/components/businesses/business-membership-list";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logoutAction } from "@/features/auth/actions";
import { requireVendorWorkspace } from "@/lib/auth/server";

export default async function SettingsPage() {
  const {
    user,
    business,
    businessContext: context,
  } = await requireVendorWorkspace("/settings");

  return (
    <WorkspacePage className="max-w-3xl">
      <section className="flex flex-col gap-3">
        <Badge variant="outline">Account</Badge>
        <div>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
            Profile &amp; account
          </h1>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
            {user.email ?? "Signed-in account"}
          </p>
        </div>
      </section>

      <Card id="my-businesses" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>My businesses</CardTitle>
          <p className="text-sm leading-5 text-muted-foreground">
            View the businesses you can access, switch workspace, or add another business.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <BusinessMembershipList
            businesses={context.businesses}
            currentBusinessId={business.id}
          />
          <div className="border-t border-border pt-4">
            <Button asChild variant="secondary" className="w-full sm:w-fit">
              <Link href={"/business" as Route}>
                <BriefcaseBusiness className="size-4" aria-hidden="true" />
                Open current business profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

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
    </WorkspacePage>
  );
}
