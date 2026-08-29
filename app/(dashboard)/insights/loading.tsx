import { WorkspacePage } from "@/components/layout/workspace-page";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2" aria-hidden="true">
      <h1 className="text-[1.625rem] font-semibold leading-tight sm:text-3xl">
        {title}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full sm:h-32" />
      ))}
    </div>
  );
}

function ScrollerSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-32 w-[82%] shrink-0 sm:h-36 sm:w-full" />
      ))}
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <WorkspacePage className="min-w-0 pb-28 lg:pb-7">
      <span className="sr-only" role="status" aria-live="polite">
        Loading insights
      </span>
      <LoadingHeading
        title="Insights"
        description="Private metrics calculated from saved business records."
      />
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-7 w-64 max-w-full" />
      </div>
      <section className="space-y-2.5">
        <Skeleton className="h-6 w-36" aria-hidden="true" />
        <MetricSkeletonGrid count={4} />
      </section>
      <section className="space-y-2.5">
        <Skeleton className="h-6 w-40" aria-hidden="true" />
        <ScrollerSkeleton />
      </section>
      <section className="space-y-2.5">
        <Skeleton className="h-6 w-40" aria-hidden="true" />
        <ScrollerSkeleton count={4} />
        <Skeleton className="h-56 w-full" aria-hidden="true" />
      </section>
      <section className="space-y-2.5">
        <Skeleton className="h-6 w-28" aria-hidden="true" />
        <MetricSkeletonGrid count={4} />
      </section>
      <section className="space-y-2.5">
        <Skeleton className="h-6 w-24" aria-hidden="true" />
        <ScrollerSkeleton />
      </section>
      <section className="space-y-2.5">
        <Skeleton className="h-6 w-20" aria-hidden="true" />
        <ScrollerSkeleton />
        <Skeleton className="h-36 w-full" aria-hidden="true" />
      </section>
    </WorkspacePage>
  );
}
