import { and, eq, ilike, inArray } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { type NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/db/client';
import { blogPostTerms, blogPosts, blogTerms, wikiArticleTerms, wikiArticles, wikiTerms } from '@/lib/db/schema';
import { formatContentLabel } from '@/lib/utils/content';

function sanitizeTitle(title: string): string {
  return sanitizeHtml(title, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

async function loadWikiCategoryNames(articleIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (articleIds.length === 0) {
    return result;
  }

  const db = getDb();
  const rows = await db
    .select({
      articleId: wikiArticleTerms.articleId,
      name: wikiTerms.name
    })
    .from(wikiArticleTerms)
    .innerJoin(wikiTerms, eq(wikiArticleTerms.termId, wikiTerms.id))
    .where(and(inArray(wikiArticleTerms.articleId, articleIds), eq(wikiTerms.taxonomy, 'category')));

  for (const row of rows) {
    if (!result.has(row.articleId)) {
      result.set(row.articleId, formatContentLabel(row.name));
    }
  }

  return result;
}

async function loadPostCategoryNames(postIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (postIds.length === 0) {
    return result;
  }

  const db = getDb();
  const rows = await db
    .select({
      postId: blogPostTerms.postId,
      name: blogTerms.name
    })
    .from(blogPostTerms)
    .innerJoin(blogTerms, eq(blogPostTerms.termId, blogTerms.id))
    .where(and(inArray(blogPostTerms.postId, postIds), eq(blogTerms.taxonomy, 'category')));

  for (const row of rows) {
    if (!result.has(row.postId)) {
      result.set(row.postId, formatContentLabel(row.name));
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ wiki: [], posts: [] });
  }

  const db = getDb();
  const pattern = `%${q}%`;

  const [wikiRows, postRows] = await Promise.all([
    db
      .select({
        id: wikiArticles.id,
        slug: wikiArticles.slug,
        title: wikiArticles.title,
        modifiedAtGmt: wikiArticles.modifiedAtGmt
      })
      .from(wikiArticles)
      .where(and(eq(wikiArticles.status, 'publish'), ilike(wikiArticles.title, pattern)))
      .limit(6),
    db
      .select({
        id: blogPosts.id,
        slug: blogPosts.slug,
        title: blogPosts.title,
        publishedAtGmt: blogPosts.publishedAtGmt
      })
      .from(blogPosts)
      .where(and(eq(blogPosts.status, 'publish'), ilike(blogPosts.title, pattern)))
      .limit(6)
  ]);

  const [wikiCategories, postCategories] = await Promise.all([
    loadWikiCategoryNames(wikiRows.map((row) => row.id)),
    loadPostCategoryNames(postRows.map((row) => row.id))
  ]);

  return NextResponse.json({
    wiki: wikiRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: sanitizeTitle(row.title),
      modifiedAtGmt: row.modifiedAtGmt?.toISOString() ?? null,
      category: wikiCategories.get(row.id) ?? null
    })),
    posts: postRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: sanitizeTitle(row.title),
      publishedAtGmt: row.publishedAtGmt?.toISOString() ?? null,
      category: postCategories.get(row.id) ?? null
    }))
  });
}
