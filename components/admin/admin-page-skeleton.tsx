import { Skeleton } from "@/components/ui/skeleton";

export function AdminDirectorySkeleton() {
  return (
    <section aria-label="Loading directory" className="space-y-6">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>
    </section>
  );
}

export function AdminDetailSkeleton() {
  return (
    <section aria-label="Loading support detail" className="space-y-8">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-none" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </section>
  );
}
