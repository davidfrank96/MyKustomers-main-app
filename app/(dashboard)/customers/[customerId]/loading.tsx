import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function CustomerDetailLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading customer"
      title="Customer details"
      description="Loading this customer record and recent private feedback."
      variant="detail"
    />
  );
}
