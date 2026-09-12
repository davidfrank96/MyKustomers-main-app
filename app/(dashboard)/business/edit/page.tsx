import { redirect } from "next/navigation";
import type { Route } from "next";
import { BusinessWorkspace } from "@/components/businesses/business-workspace";
import {
  WorkspaceBackLink,
  WorkspacePage,
  WorkspacePageHeader,
} from "@/components/layout/workspace-page";
import { updateBusinessProfileAction } from "@/features/businesses/actions";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getCurrentBusinessProfile } from "@/features/businesses/server";

export default async function BusinessEditPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const result = await getCurrentBusinessProfile();
  if (result.status === "none") redirect("/onboarding" as Route);
  const { section } = await searchParams;
  const initialEditSection =
    section === "contact" || section === "address" ? section : "information";
  const business = result.business;

  return (
    <WorkspacePage className="max-w-5xl">
      <div>
        <WorkspaceBackLink href="/business">My Profile</WorkspaceBackLink>
      </div>
      <WorkspacePageHeader
        title="Business settings"
        description="Manage your business profile and information in one place."
      />
      <BusinessWorkspace
        key={`${business.id}-${initialEditSection}`}
        initialEditSection={initialEditSection}
        isOwner={result.role === "owner"}
        updateAction={updateBusinessProfileAction.bind(null, business.id)}
        business={{
          id: business.id,
          name: business.name,
          slug: business.slug,
          category: business.category,
          description: business.description,
          phone: business.phone,
          email: business.email,
          whatsapp: business.whatsapp,
          instagram: business.instagram,
          website: business.website,
          addressText: business.address_text,
          logoUrl: getBusinessLogoPublicUrl(business.logo_path),
        }}
      />
    </WorkspacePage>
  );
}
