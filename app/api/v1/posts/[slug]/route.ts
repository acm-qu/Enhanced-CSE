import { toPostDetailResponse } from '@/lib/content/transform';
import { getPostBySlug } from '@/lib/db/posts-queries';
import { badRequest, internalError, jsonCached, notFound } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
): Promise<Response> {
  try {
    const slug = params.slug?.trim();
    if (!slug) {
      return badRequest('slug is required');
    }

    const post = await getPostBySlug(slug);
    if (!post) {
      return notFound('Post not found');
    }

    return jsonCached({ post: toPostDetailResponse(post) }, CACHE_CONTROL);
  } catch {
    return internalError();
  }
}
