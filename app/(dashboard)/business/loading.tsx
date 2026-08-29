import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function BusinessLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading business"
      title="Business"
      description="Manage your business profile and information in one place."
      variant="business"
    />
  );
}
