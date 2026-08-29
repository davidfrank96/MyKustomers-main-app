"use client";

import { Building2, Check, MapPin, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import {
  BusinessOnboardingForm,
  type BusinessEditSection,
} from "@/components/forms/business-onboarding-form";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BusinessActionState } from "@/features/businesses/action-state";

type BusinessWorkspaceProps = {
  business: {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    instagram: string | null;
    website: string | null;
    addressText: string | null;
    logoUrl: string | null;
  };
  isOwner: boolean;
  updateAction: (
    previousState: BusinessActionState,
    formData: FormData,
  ) => Promise<BusinessActionState>;
};

export function BusinessWorkspace({
  business,
  isOwner,
  updateAction,
}: BusinessWorkspaceProps) {
  const [activeEditSection, setActiveEditSection] = useState<BusinessEditSection | null>(
    null,
  );

  const openEditSection = useCallback((section: BusinessEditSection) => {
    setActiveEditSection(section);
    window.requestAnimationFrame(() => {
      document.getElementById(`business-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const toggleEditSection = useCallback(
    (section: BusinessEditSection) => {
      if (activeEditSection === section) {
        setActiveEditSection(null);
        return;
      }

      openEditSection(section);
    },
    [activeEditSection, openEditSection],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <section aria-labelledby="current-business-heading">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="current-business-heading" className="text-sm font-semibold">
              Current business
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 shrink-0"
              onClick={() => openEditSection("information")}
            >
              <Pencil className="size-4" aria-hidden="true" />
              {isOwner ? "Edit" : "View"}
            </Button>
          </div>

          <div className="mt-4 flex min-w-0 items-start gap-4">
            <BusinessLogo
              name={business.name}
              url={business.logoUrl}
              className="size-20 shrink-0 rounded-lg sm:size-24"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="min-w-0 break-words text-lg font-semibold leading-6 [overflow-wrap:anywhere]">
                  {business.name}
                </p>
                <Badge className="gap-1 border-primary/20 bg-primary/10 text-primary">
                  <Check className="size-3" aria-hidden="true" />
                  Active
                </Badge>
              </div>
              <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="break-words">{business.category}</span>
              </p>
              {business.addressText ? (
                <p className="mt-1.5 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="break-words [overflow-wrap:anywhere]">
                    {business.addressText}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="business-details-heading" className="space-y-3">
        <h2 id="business-details-heading" className="text-lg font-semibold">
          Business details
        </h2>
        <BusinessOnboardingForm
          action={updateAction}
          mode="edit"
          isOwner={isOwner}
          sectionedEdit
          activeEditSection={activeEditSection}
          onEditSectionChange={toggleEditSection}
          editLogo={{
            businessId: business.id,
            businessName: business.name,
            currentLogoUrl: business.logoUrl,
          }}
          initialValues={{
            name: business.name,
            slug: business.slug,
            category: business.category,
            description: business.description,
            phone: business.phone,
            email: business.email,
            whatsapp: business.whatsapp,
            instagram: business.instagram,
            website: business.website,
            addressText: business.addressText,
          }}
        />
      </section>
    </div>
  );
}
