import { Skeleton } from "@/components/ui/skeleton";

type WorkspacePageSkeletonProps = {
  label: string;
  variant: "dashboard" | "list" | "detail" | "form";
};

function PageHeadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-full max-w-72" />
      <Skeleton className="h-5 w-full max-w-xl" />
    </div>
  );
}

function Rows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-5 w-full max-w-52" />
          <Skeleton className="mt-3 h-4 w-full max-w-sm" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-64" />
        </div>
      ))}
    </div>
  );
}

export function WorkspacePageSkeleton({ label, variant }: WorkspacePageSkeletonProps) {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-hidden px-5 py-6 sm:px-8 lg:px-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <PageHeadingSkeleton />

        {variant === "dashboard" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-32 w-full" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-40 w-full" />
              ))}
            </div>
          </>
        ) : null}

        {variant === "list" ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Rows />
          </>
        ) : null}

        {variant === "detail" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Rows count={3} />
          </>
        ) : null}

        {variant === "form" ? (
          <div className="space-y-5 rounded-lg border border-border bg-card p-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-11 w-full max-w-40" />
          </div>
        ) : null}
      </div>
    </main>
  );
}
