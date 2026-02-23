import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="content-shell space-y-5">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
