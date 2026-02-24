import { toArticleDetailResponse } from '@/lib/content/transform';
import { getArticleBySlug } from '@/lib/db/queries';
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

    const article = await getArticleBySlug(slug);
    if (!article) {
      return notFound('Article not found');
    }

    return jsonCached({ article: toArticleDetailResponse(article) }, CACHE_CONTROL);
  } catch {
    return internalError();
  }
}
