import { Skeleton } from "@/components/ui/skeleton";

function Panel({ rows }: { rows: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-6 w-40 max-w-full" />
      <div className="mt-3 divide-y divide-border rounded-md border border-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="space-y-2 p-3">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminSecurityLoading() {
  return (
    <section
      aria-label="Loading security and health"
      aria-busy="true"
      className="min-w-0 space-y-5"
    >
      <p role="status" className="sr-only">
        Loading security and health
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1 h-10 w-72 max-w-full" />
          <Skeleton className="mt-2 h-6 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-11 w-full md:w-44" />
      </div>
      <div className="grid divide-y divide-border rounded-lg border border-border bg-card md:grid-cols-3 md:divide-x md:divide-y-0">
        {[0, 1, 2].map((item) => (
          <div key={item} className="min-w-0 space-y-3 p-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Panel rows={4} />
          <Panel rows={4} />
          <Panel rows={4} />
        </div>
        <div className="space-y-4">
          <Panel rows={2} />
          <Panel rows={2} />
          <Panel rows={5} />
          <Panel rows={7} />
        </div>
      </div>
    </section>
  );
}
