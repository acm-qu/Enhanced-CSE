import { listCategories } from '@/lib/db/queries';
import { internalError, jsonCached } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(): Promise<Response> {
  try {
    const categories = await listCategories();
    return jsonCached({ categories }, CACHE_CONTROL);
  } catch {
    return internalError();
  }
}
