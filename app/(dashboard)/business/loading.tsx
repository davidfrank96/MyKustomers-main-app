import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function BusinessLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading business"
      title="Business profile"
      description="Loading the selected business identity and settings."
      variant="form"
    />
  );
}
