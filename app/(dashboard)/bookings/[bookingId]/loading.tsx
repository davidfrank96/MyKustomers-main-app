import { Skeleton } from "@/components/ui/skeleton";

export default function BookingDetailLoading() {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 overflow-hidden px-4 py-5 sm:gap-6 sm:px-8 sm:py-7 lg:px-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading booking</span>
      <h1
        title="Booking details"
        className="text-[1.625rem] font-semibold leading-tight sm:text-3xl"
      >
        Booking details
      </h1>
      <Skeleton className="h-9 w-24" aria-hidden />

      <div
        className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5"
        aria-hidden
      >
        <div className="flex gap-2">
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <Skeleton className="h-9 w-2/3 max-w-80" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>

      <div
        className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5"
        aria-hidden
      >
        <div className="flex gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
        </div>
        <div className="space-y-3 rounded-md border border-border p-4 sm:ml-14">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-full max-w-lg" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>

      <Skeleton className="h-16 w-full rounded-lg" aria-hidden />

      <div
        className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5"
        aria-hidden
      >
        <Skeleton className="h-6 w-36" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3" aria-hidden>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
