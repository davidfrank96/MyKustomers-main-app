import { WorkspacePageSkeleton } from "@/components/shared/workspace-page-skeleton";

export default function BookingDetailLoading() {
  return (
    <WorkspacePageSkeleton
      label="Loading booking"
      title="Booking details"
      description="Loading the current booking state and available actions."
      variant="detail"
    />
  );
}
