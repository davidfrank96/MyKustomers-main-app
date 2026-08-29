import { Skeleton } from "@/components/ui/skeleton";

type WorkspacePageSkeletonProps = {
  label: string;
  variant: "dashboard" | "list" | "detail" | "form" | "business";
  title?: string;
  description?: string;
};

function PageHeadingSkeleton({
  title,
  description,
}: Pick<WorkspacePageSkeletonProps, "title" | "description">) {
  return (
    <div className="space-y-2">
      <Skeleton className="hidden h-6 w-24 sm:block" aria-hidden />
      {title ? (
        <h1 className="text-[1.625rem] font-semibold leading-tight sm:text-3xl">{title}</h1>
      ) : (
        <Skeleton className="h-9 w-full max-w-72" aria-hidden />
      )}
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      ) : (
        <Skeleton className="h-5 w-full max-w-xl" aria-hidden />
      )}
    </div>
  );
}

function Rows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="p-4">
          <Skeleton className="h-5 w-full max-w-52" />
          <Skeleton className="mt-3 h-4 w-full max-w-sm" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-64" />
        </div>
      ))}
    </div>
  );
}

export function WorkspacePageSkeleton({
  label,
  variant,
  title,
  description,
}: WorkspacePageSkeletonProps) {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 overflow-hidden px-4 py-5 sm:gap-6 sm:px-8 sm:py-7 lg:px-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-5 sm:space-y-6">
        <PageHeadingSkeleton title={title} description={description} />

        {variant === "dashboard" ? (
          <div aria-hidden="true" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full sm:h-28" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : null}

        {variant === "list" ? (
          <div aria-hidden="true" className="space-y-5">
            <Skeleton className="h-40 w-full" />
            <Rows />
          </div>
        ) : null}

        {variant === "detail" ? (
          <div aria-hidden="true" className="space-y-5">
            <Skeleton className="h-64 w-full" />
            <Rows count={3} />
          </div>
        ) : null}

        {variant === "form" ? (
          <div
            aria-hidden="true"
            className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5"
          >
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-11 w-full max-w-40" />
          </div>
        ) : null}

        {variant === "business" ? (
          <div aria-hidden="true" className="space-y-5">
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-11 w-20" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="size-20 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-3 py-1">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-36" />
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex h-16 items-center gap-3 px-4">
                    <Skeleton className="size-9 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        ) : null}
      </div>
    </main>
  );
}
