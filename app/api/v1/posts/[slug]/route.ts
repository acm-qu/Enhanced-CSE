import { NextResponse } from 'next/server';

import { toPostDetailResponse } from '@/lib/content/transform';
import { getPostBySlug } from '@/lib/db/posts-queries';
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

    const post = await getPostBySlug(slug);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const response = NextResponse.json({ post: toPostDetailResponse(post) });
    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  } catch {
    return internalError();
  }
}
