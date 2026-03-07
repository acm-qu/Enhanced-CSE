import { HackerLines } from '@/components/hacker-loader';

function Pulse({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-foreground/[0.08] ${className}`} style={style} />;
}

export default function WikiArticleLoading() {
  return (
    <main className="content-shell">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
        {/* Left meta sidebar */}
        <aside className="hidden xl:block">
          <div className="panel-muted sticky top-20 rounded-xl border px-4 py-4">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em]">Article Meta</p>
            <div className="space-y-3">
              <Pulse className="h-4 w-4/5" />
              <Pulse className="h-4 w-3/4" />
              <div className="my-2 border-t border-foreground/10" />
              <Pulse className="h-8 w-28" />
            </div>
          </div>
        </aside>

        {/* Article body */}
        <article>
          <div className="panel rounded-xl border px-5 py-6 sm:px-6 sm:py-7">
            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>Home</span><span className="opacity-40">/</span>
              <span>Wiki</span><span className="opacity-40">/</span>
              <Pulse className="inline-block h-4 w-24" />
            </div>

            {/* Title skeleton */}
            <Pulse className="mb-2 h-10 w-3/4 sm:h-12" />
            <Pulse className="mb-6 h-10 w-2/5 sm:h-12" />

            {/* Date stamps */}
            <div className="mb-4 flex flex-wrap gap-4">
              <Pulse className="h-3 w-48" />
              <Pulse className="h-3 w-48" />
            </div>

            {/* Category badges */}
            <div className="mb-8 flex gap-2">
              <Pulse className="h-6 w-28 rounded-full" />
              <Pulse className="h-6 w-24 rounded-full" />
            </div>

            {/* Hacker animation runs inside the article body */}
            <HackerLines
              className="mb-6"
              lines={[
                'Fetching article by slug',
                'Loading categories and tags',
                'Building table of contents',
                'Rendering article content',
              ]}
            />

            {/* Rest of body content skeleton */}
            <div className="space-y-3">
              <Pulse className="h-4" />
              <Pulse className="h-4 w-11/12" />
              <Pulse className="h-4 w-5/6" />
              <Pulse className="h-4" />
              <div className="pt-2" />
              <Pulse className="h-6 w-2/5" />
              <Pulse className="h-4" />
              <Pulse className="h-4 w-3/4" />
              <Pulse className="h-4" />
              <div className="pt-2" />
              <Pulse className="h-4" />
              <Pulse className="h-4 w-4/6" />
              <Pulse className="h-4 w-5/6" />
            </div>
          </div>
        </article>

        {/* Right TOC sidebar */}
        <aside className="hidden xl:block">
          <div className="no-scrollbar sticky top-20 pt-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
              On This Page
            </p>
            <div className="space-y-2.5">
              <Pulse className="h-3 w-4/5" />
              <Pulse className="h-3 w-3/5 ml-3" />
              <Pulse className="h-3 w-2/3 ml-3" />
              <Pulse className="h-3 w-4/5" />
              <Pulse className="h-3 w-3/4" />
              <Pulse className="h-3 w-2/5 ml-3" />
              <Pulse className="h-3 w-4/5" />
              <Pulse className="h-3 w-3/5" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
