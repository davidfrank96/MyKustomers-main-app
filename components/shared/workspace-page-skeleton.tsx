import { Skeleton } from "@/components/ui/skeleton";

type WorkspacePageSkeletonProps = {
  label: string;
  variant: "dashboard" | "list" | "detail" | "form";
  title?: string;
  description?: string;
};

function PageHeadingSkeleton({
  title,
  description,
}: Pick<WorkspacePageSkeletonProps, "title" | "description">) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-24" aria-hidden />
      {title ? (
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
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

export function WorkspacePageSkeleton({
  label,
  variant,
  title,
  description,
}: WorkspacePageSkeletonProps) {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-hidden px-5 py-6 sm:px-8 lg:px-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-6">
        <PageHeadingSkeleton title={title} description={description} />

        {variant === "dashboard" ? (
          <div aria-hidden="true" className="space-y-6">
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
          </div>
        ) : null}

        {variant === "list" ? (
          <div aria-hidden="true" className="space-y-6">
            <Skeleton className="h-28 w-full" />
            <Rows />
          </div>
        ) : null}

        {variant === "detail" ? (
          <div aria-hidden="true" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Rows count={3} />
          </div>
        ) : null}

        {variant === "form" ? (
          <div
            aria-hidden="true"
            className="space-y-5 rounded-lg border border-border bg-card p-5"
          >
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
