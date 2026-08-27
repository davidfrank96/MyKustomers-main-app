import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function BookingsLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading bookings"
      title="Bookings"
      description="Loading your current business bookings and filters."
      variant="list"
    />
  );
}
