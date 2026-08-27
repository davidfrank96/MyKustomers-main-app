import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function CustomersLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading customers"
      title="Customers"
      description="Loading customer records for your current business."
      variant="list"
    />
  );
}
