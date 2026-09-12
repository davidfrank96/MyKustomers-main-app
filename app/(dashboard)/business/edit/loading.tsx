import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function BusinessEditLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading business settings"
      title="Business settings"
      description="Manage your business profile and information in one place."
      variant="business"
    />
  );
}
