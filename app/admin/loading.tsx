function SkeletonMetric() {
  return (
    <div className="min-h-36 border-b border-r border-border p-4 sm:p-5">
      <div className="h-4 w-24 animate-pulse bg-muted" />
      <div className="mt-5 h-8 w-16 animate-pulse bg-muted" />
      <div className="mt-3 h-3 w-32 max-w-full animate-pulse bg-muted" />
    </div>
  );
}

export default function AdminLoading() {
  return (
    <section aria-label="Loading platform operations" aria-busy="true">
      <div className="border-b border-border pb-6">
        <div className="h-4 w-32 animate-pulse bg-muted" />
        <div className="mt-3 h-9 w-44 animate-pulse bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md animate-pulse bg-muted" />
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="pt-8">
          <div className="h-5 w-40 animate-pulse bg-muted" />
          <div className="mt-4 grid grid-cols-2 border-l border-t border-border lg:grid-cols-4">
            {[0, 1, 2, 3].map((metric) => (
              <SkeletonMetric key={metric} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
