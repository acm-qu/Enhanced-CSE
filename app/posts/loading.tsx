import { HackerLines } from '@/components/hacker-loader';

function Pulse({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-foreground/[0.08] ${className}`} style={style} />;
}

function PlainCardSkeleton({ titleW = '74%' }: { titleW?: string }) {
  return (
    <div className="panel-muted rounded-xl border px-5 py-5 sm:px-6">
      <Pulse className="mb-3 h-5 w-28 rounded-full" />
      <Pulse className="mb-1.5 h-6" style={{ width: titleW }} />
      <Pulse className="mb-5 h-6 w-2/5" />
      <div className="space-y-2">
        <Pulse className="h-4" />
        <Pulse className="h-4" />
        <Pulse className="h-4 w-3/5" />
      </div>
      <Pulse className="mt-3 h-4 w-32" />
      <div className="mt-4 flex gap-1.5">
        <Pulse className="h-7 w-20" />
        <Pulse className="h-7 w-28" />
      </div>
    </div>
  );
}

export default function PostsLoading() {
  return (
    <main className="content-shell content-shell-tight">
      <section className="panel px-5 py-6 sm:px-6">
        <p className="mb-3 text-sm text-muted-foreground">
          <span>Home</span>
          <span className="mx-1.5 opacity-50">/</span>
          <span>Blog</span>
        </p>
        <span className="mb-2 inline-block rounded-md border border-foreground/20 px-2.5 py-0.5 text-xs font-semibold">
          Blog
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Articles</h1>
        <p className="mt-2 text-sm text-muted-foreground">Main-site posts with category and archive navigation.</p>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="panel-muted order-2 h-fit rounded-xl border px-4 py-4 lg:order-1 lg:sticky lg:top-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em]">Filters</p>
          <div className="space-y-2.5">
            <Pulse className="h-8" />
            <Pulse className="h-8" />
            <Pulse className="h-8" />
          </div>
          <div className="my-4 border-t border-foreground/10" />
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Recent archives
          </p>
          <div className="flex flex-col gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Pulse key={i} className="h-8" />
            ))}
          </div>
        </div>

        {/* Post list */}
        <section className="order-1 lg:order-2">
          <Pulse className="h-4 w-36" />
          <div className="mt-3 grid gap-3">
            {/* First card — hacker animation lives here */}
            <div className="panel-muted rounded-xl border px-5 py-5 sm:px-6">
              <Pulse className="mb-4 h-5 w-28 rounded-full" />
              <HackerLines
                lines={[
                  'Connecting to posts archive',
                  'Loading article metadata',
                  'Resolving filters and archives',
                  'Rendering post collection',
                ]}
              />
              <div className="mt-5 flex gap-1.5">
                <Pulse className="h-7 w-20" />
                <Pulse className="h-7 w-28" />
              </div>
            </div>

            <PlainCardSkeleton titleW="65%" />
            <PlainCardSkeleton titleW="80%" />
            <PlainCardSkeleton titleW="58%" />
            <PlainCardSkeleton titleW="70%" />
          </div>
        </section>
      </section>
    </main>
  );
}
