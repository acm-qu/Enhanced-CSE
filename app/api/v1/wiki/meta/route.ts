import { getSyncMeta } from '@/lib/db/queries';
import { internalError, jsonCached } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=120';

export async function GET(): Promise<Response> {
  try {
    const meta = await getSyncMeta();
    return jsonCached({
      hasTags: meta.hasTags,
      lastSuccessAt: meta.lastSuccessAt?.toISOString() ?? null,
      lastRunStatus: meta.lastRunStatus
    }, CACHE_CONTROL);
  } catch {
    return internalError();
  }
}
