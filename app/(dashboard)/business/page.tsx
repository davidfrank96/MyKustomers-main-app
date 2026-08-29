import { redirect } from "next/navigation";
import type { Route } from "next";
import { WorkspacePage, WorkspacePageHeader } from "@/components/layout/workspace-page";
import { BusinessWorkspace } from "@/components/businesses/business-workspace";
import { updateBusinessProfileAction } from "@/features/businesses/actions";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getCurrentBusinessProfile } from "@/features/businesses/server";

export default async function BusinessPage() {
  const result = await getCurrentBusinessProfile();

  if (result.status === "none") {
    redirect("/onboarding" as Route);
  }

  const isOwner = result.role === "owner";

  return (
    <WorkspacePage className="max-w-5xl">
      <WorkspacePageHeader
        title="Business"
        description="Manage your business profile and information in one place."
      />

      <BusinessWorkspace
        business={{
          id: result.business.id,
          name: result.business.name,
          slug: result.business.slug,
          category: result.business.category,
          description: result.business.description,
          phone: result.business.phone,
          email: result.business.email,
          whatsapp: result.business.whatsapp,
          instagram: result.business.instagram,
          website: result.business.website,
          addressText: result.business.address_text,
          logoUrl: getBusinessLogoPublicUrl(result.business.logo_path),
        }}
        isOwner={isOwner}
        updateAction={updateBusinessProfileAction.bind(null, result.business.id)}
      />
    </WorkspacePage>
  );
}
