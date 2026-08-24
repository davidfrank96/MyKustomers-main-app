"use client";

import Link from "next/link";
import type { Route } from "next";
import { Check, Plus } from "lucide-react";
import { useFormStatus } from "react-dom";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { switchCurrentBusinessAction } from "@/features/businesses/switch-action";
import type { BusinessSummary } from "@/lib/auth/server";

function roleLabel(role: BusinessSummary["role"]) {
  return role === "owner" ? "Owner" : "Member";
}

function SwitchButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="secondary"
      size="lg"
      className="w-full sm:w-auto"
      disabled={pending}
    >
      {pending ? "Switching..." : "Switch"}
    </Button>
  );
}

export function BusinessMembershipList({
  businesses,
  currentBusinessId,
}: {
  businesses: BusinessSummary[];
  currentBusinessId: string;
}) {
  return (
    <div>
      <ul className="divide-y divide-border" aria-label="Active business memberships">
        {businesses.map((business) => {
          const isCurrent = business.id === currentBusinessId;

          return (
            <li
              key={business.id}
              className="flex min-w-0 flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <BusinessLogo
                  name={business.name}
                  url={getBusinessLogoPublicUrl(business.logoPath)}
                  className="size-11"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">
                    {business.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {roleLabel(business.role)}
                  </p>
                </div>
              </div>

              {isCurrent ? (
                <Badge variant="outline" aria-current="true" className="min-h-9 gap-1.5">
                  <Check className="size-4" aria-hidden="true" />
                  Current business
                </Badge>
              ) : (
                <form
                  action={switchCurrentBusinessAction}
                  data-business-page-switch-form
                  className="w-full sm:w-auto"
                >
                  <input type="hidden" name="businessId" value={business.id} />
                  <SwitchButton />
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-4">
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href={"/business/new" as Route}>
            <Plus className="size-4" aria-hidden="true" />
            Add another business
          </Link>
        </Button>
      </div>
    </div>
  );
}
