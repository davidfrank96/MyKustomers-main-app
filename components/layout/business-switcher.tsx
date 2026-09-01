"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRef } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { BusinessLogo } from "@/components/shared/business-logo";
import { BusinessSwitchPending } from "@/components/businesses/business-switch-pending";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchCurrentBusinessAction } from "@/features/businesses/switch-action";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import type { BusinessSummary } from "@/lib/auth/server";

type BusinessSwitcherProps = {
  businesses: BusinessSummary[];
  currentBusiness: BusinessSummary | null;
};

function BusinessSwitchOption({
  business,
  isCurrent,
}: {
  business: BusinessSummary;
  isCurrent: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={switchCurrentBusinessAction} data-business-switch-form>
      <input type="hidden" name="businessId" value={business.id} />
      <DropdownMenuItem
        className="gap-3"
        disabled={isCurrent}
        aria-current={isCurrent ? "true" : undefined}
        onSelect={(event) => {
          if (!isCurrent) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      >
        <BusinessLogo
          name={business.name}
          url={getBusinessLogoPublicUrl(business.logoPath)}
          className="size-8 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{business.name}</span>
          <span className="block text-xs capitalize text-muted-foreground">
            {business.role === "owner" ? "Owner" : "Member"}
          </span>
        </span>
        {isCurrent ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            <Check className="size-4" aria-hidden="true" />
            Current
          </span>
        ) : null}
      </DropdownMenuItem>
      <BusinessSwitchPending />
    </form>
  );
}

export function BusinessSwitcher({ businesses, currentBusiness }: BusinessSwitcherProps) {
  if (!currentBusiness) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Switch business. Current business: ${currentBusiness.name}`}
          className="h-11 min-w-0 max-w-[11.5rem] justify-start gap-2 px-1.5 sm:max-w-64 sm:px-2"
        >
          <BusinessLogo
            name={currentBusiness.name}
            url={getBusinessLogoPublicUrl(currentBusiness.logoPath)}
            className="size-7 shrink-0 rounded-md"
          />
          <span className="truncate text-[0.8125rem] font-semibold sm:text-sm">
            {currentBusiness.name}
          </span>
          <ChevronDown
            className="ml-auto size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Businesses</p>
        </div>
        {businesses.map((business) => {
          const isCurrent = business.id === currentBusiness.id;

          return (
            <BusinessSwitchOption
              business={business}
              isCurrent={isCurrent}
              key={business.id}
            />
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={"/business/new" as Route} className="gap-3">
            <Plus className="size-4" aria-hidden="true" />
            Add another business
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
