import { Skeleton } from "@/components/ui/skeleton";

function SkeletonMetric() {
  return (
    <div className="grid min-h-36 min-w-0 grid-cols-[44px_minmax(0,1fr)] content-start gap-x-4 rounded-lg border border-border bg-card p-5">
      <Skeleton className="row-span-3 size-11" />
      <Skeleton className="h-5 w-24 max-w-full" />
      <Skeleton className="mt-1 h-10 w-16 max-w-full" />
      <Skeleton className="mt-2 h-9 w-full" />
    </div>
  );
}

export default function AdminLoading() {
  return (
    <section
      aria-label="Loading platform operations"
      aria-busy="true"
      className="min-w-0"
    >
      <p role="status" className="sr-only">
        Loading platform operations
      </p>
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1 h-10 w-44" />
          <Skeleton className="mt-2 h-6 w-full max-w-xl" />
        </div>
        <Skeleton className="h-6 w-72 max-w-full" />
      </div>
      {[0, 1].map((section) => (
        <div key={section} className={section === 0 ? "pt-6" : "pt-5"}>
          <Skeleton className="h-6 w-40" />
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((metric) => (
              <SkeletonMetric key={metric} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-5 rounded-lg border border-border bg-card p-3 sm:p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-0.5 h-5 w-80 max-w-full" />
        <div className="mt-3 divide-y divide-border rounded-md border border-border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="min-h-20 px-3 py-3 md:min-h-11">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 gap-4 pt-4 lg:grid-cols-2">
        {[0, 1].map((panel) => (
          <div
            key={panel}
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-3 h-[150px] w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
