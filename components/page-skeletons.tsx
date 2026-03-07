function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-foreground/8 ${className}`} />;
}

export function HomePageSkeleton() {
  return (
    <main className="content-shell space-y-6 py-8">
      <section className="panel space-y-5 px-5 py-8 sm:px-6">
        <SkeletonBlock className="h-5 w-44" />
        <SkeletonBlock className="h-12 w-full max-w-2xl" />
        <SkeletonBlock className="h-6 w-full max-w-3xl" />
        <div className="flex flex-wrap gap-3">
          <SkeletonBlock className="h-11 w-40" />
          <SkeletonBlock className="h-11 w-40" />
          <SkeletonBlock className="h-11 w-40" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-72 w-full" />
        <SkeletonBlock className="h-72 w-full" />
      </section>
    </main>
  );
}

export function ContentCollectionSkeleton() {
  return (
    <main className="content-shell content-shell-tight space-y-5 py-6">
      <section className="panel space-y-4 px-5 py-6 sm:px-6">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-10 w-56" />
        <SkeletonBlock className="h-5 w-full max-w-xl" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3 lg:order-1">
          <SkeletonBlock className="h-64 w-full" />
        </div>

        <div className="space-y-3 lg:order-2">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="h-56 w-full" />
          <SkeletonBlock className="h-56 w-full" />
          <SkeletonBlock className="h-56 w-full" />
        </div>
      </section>
    </main>
  );
}

export function StudyPlanSkeleton() {
  return (
    <main className="content-shell space-y-6 py-8">
      <section className="space-y-4">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-12 w-full max-w-lg" />
        <SkeletonBlock className="h-5 w-full max-w-xl" />
        <SkeletonBlock className="h-5 w-72" />
      </section>

      <section className="panel space-y-4 px-5 py-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <SkeletonBlock className="h-80 w-full" />
          <SkeletonBlock className="h-80 w-full" />
          <SkeletonBlock className="h-80 w-full" />
          <SkeletonBlock className="h-80 w-full" />
        </div>
        <SkeletonBlock className="h-14 w-full" />
      </section>

      <section className="panel-muted space-y-4 px-5 py-6 sm:px-6">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-10 w-full max-w-3xl" />
        <SkeletonBlock className="h-5 w-full" />
        <SkeletonBlock className="h-5 w-full" />
        <SkeletonBlock className="h-5 w-5/6" />
      </section>
    </main>
  );
}
