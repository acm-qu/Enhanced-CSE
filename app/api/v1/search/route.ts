import { and, eq, ilike } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/db/client';
import { blogPosts, wikiArticles } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ wiki: [], posts: [] });
  }

  const db = getDb();
  const pattern = `%${q}%`;

  const [wikiRows, postRows] = await Promise.all([
    db
      .select({ id: wikiArticles.id, slug: wikiArticles.slug, title: wikiArticles.title })
      .from(wikiArticles)
      .where(and(eq(wikiArticles.status, 'publish'), ilike(wikiArticles.title, pattern)))
      .limit(6),
    db
      .select({ id: blogPosts.id, slug: blogPosts.slug, title: blogPosts.title })
      .from(blogPosts)
      .where(and(eq(blogPosts.status, 'publish'), ilike(blogPosts.title, pattern)))
      .limit(6)
  ]);

  return NextResponse.json({ wiki: wikiRows, posts: postRows });
}
