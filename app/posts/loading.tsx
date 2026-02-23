import { Skeleton } from '@/components/ui/skeleton';

export default function PostsLoading() {
  return (
    <main className="content-shell">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
