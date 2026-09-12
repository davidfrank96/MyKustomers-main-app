import { redirect } from "next/navigation";
import type { Route } from "next";
import { WorkspacePage, WorkspacePageHeader } from "@/components/layout/workspace-page";
import { MyProfileHub } from "@/components/businesses/my-profile-hub";
import { getBusinessLogoPublicUrl } from "@/features/businesses/logo-public";
import { getCurrentBusinessProfile } from "@/features/businesses/server";

export default async function BusinessPage() {
  const result = await getCurrentBusinessProfile();

  if (result.status === "none") {
    redirect("/onboarding" as Route);
  }

  return (
    <WorkspacePage className="max-w-3xl">
      <WorkspacePageHeader
        title="My Profile"
        description="Manage your business, account, and preferences in one place."
        className="[&_h1]:text-[1.75rem] min-[375px]:[&_h1]:text-[1.875rem]"
      />

      <MyProfileHub
        isOwner={result.role === "owner"}
        business={{
          name: result.business.name,
          category: result.business.category,
          logoUrl: getBusinessLogoPublicUrl(result.business.logo_path),
          createdAt: result.business.created_at,
        }}
      />
    </WorkspacePage>
  );
}
