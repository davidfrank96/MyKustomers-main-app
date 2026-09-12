import { WorkspacePage, WorkspacePageHeader } from "@/components/layout/workspace-page";
import { MyProfileHubSkeleton } from "@/components/businesses/my-profile-hub";

export default function BusinessLoading() {
  return (
    <WorkspacePage className="max-w-3xl">
      <WorkspacePageHeader
        title="My Profile"
        description="Manage your business, account, and preferences in one place."
        className="[&_h1]:text-[1.75rem] min-[375px]:[&_h1]:text-[1.875rem]"
      />
      <MyProfileHubSkeleton />
    </WorkspacePage>
  );
}
