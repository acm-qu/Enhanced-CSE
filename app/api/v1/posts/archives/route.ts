import { NextRequest, NextResponse } from 'next/server';

import { listPostArchives } from '@/lib/db/posts-queries';
import { internalError } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
    const archives = await listPostArchives({ categorySlug: category });

    const response = NextResponse.json({
      category: category ?? null,
      archives
    });

    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  } catch {
    return internalError();
  }
}
