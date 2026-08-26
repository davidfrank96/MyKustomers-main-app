function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted ${className}`} />;
}

export default function AdminSecurityLoading() {
  return (
    <section aria-label="Loading security and health" aria-busy="true">
      <div className="border-b border-border pb-6">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="mt-3 h-9 w-64 max-w-full" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-xl" />
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="min-h-28 border border-border p-5">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="mt-4 h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-10 grid border-l border-t border-border md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="min-h-48 border-b border-r border-border p-5">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="mt-6 h-4 w-full" />
            <SkeletonBlock className="mt-3 h-4 w-3/4" />
          </div>
        ))}
      </div>
    </section>
  );
}
