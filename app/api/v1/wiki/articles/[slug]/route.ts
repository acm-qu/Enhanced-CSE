import { NextResponse } from 'next/server';

import { toArticleDetailResponse } from '@/lib/content/transform';
import { getArticleBySlug } from '@/lib/db/queries';
import { badRequest, internalError } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  try {
    const slug = params.slug?.trim();
    if (!slug) {
      return badRequest('slug is required');
    }

    const article = await getArticleBySlug(slug);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const response = NextResponse.json({ article: toArticleDetailResponse(article) });
    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  } catch {
    return internalError();
  }
}
