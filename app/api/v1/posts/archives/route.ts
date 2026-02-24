import { NextRequest } from 'next/server';

import { listPostArchives } from '@/lib/db/posts-queries';
import { internalError, jsonCached } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
    const archives = await listPostArchives({ categorySlug: category });
    return jsonCached({ category: category ?? null, archives }, CACHE_CONTROL);
  } catch {
    return internalError();
  }
}
