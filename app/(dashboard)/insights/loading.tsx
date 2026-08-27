import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function InsightsLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading insights"
      title="Insights"
      description="Loading private metrics for your current business."
      variant="dashboard"
    />
  );
}
