import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-5 py-8">
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-3/4" />
    </main>
  );
}
