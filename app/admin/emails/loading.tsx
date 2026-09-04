import { Skeleton } from "@/components/ui/skeleton";

export default function AdminEmailsLoading() {
  return (
    <section
      aria-label="Loading Email Operations"
      aria-busy="true"
      className="min-w-0 space-y-4"
    >
      <p role="status" className="sr-only">
        Loading Email Operations
      </p>
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-12 w-full max-w-3xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <div
            key={key}
            className="flex min-w-0 gap-4 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="size-10 shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-5 w-48" />
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-32 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-6 w-40" />
        <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-[2fr_repeat(3,1fr)]">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton
              key={key}
              className={`h-14 w-full ${key === 0 ? "md:col-span-3 xl:col-span-1" : ""}`}
            />
          ))}
        </div>
        <Skeleton className="my-3 h-8 w-full" />
        <div className="divide-y divide-border rounded-md border border-border">
          {[0, 1, 2, 3, 4].map((key) => (
            <div key={key} className="grid gap-3 p-3 md:grid-cols-[5rem_1fr_13rem]">
              <Skeleton className="h-6 w-16" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
