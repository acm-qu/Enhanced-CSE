import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lte,
  sql,
  type SQL
} from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { blogPostTerms, blogPosts, blogTerms } from '@/lib/db/schema';

export type PostSort = 'published_desc' | 'published_asc' | 'modified_desc' | 'modified_asc';

export interface ListPostsInput {
  page: number;
  pageSize: number;
  categorySlug?: string;
  after?: Date;
  before?: Date;
  sort: PostSort;
}

export interface PostListItem {
  id: number;
  slug: string;
  title: string;
  excerptHtmlRaw: string;
  sourceLink: string;
  publishedAtGmt: Date | null;
  modifiedAtGmt: Date | null;
  categories: string[];
}

export interface PostDetailItem {
  id: number;
  slug: string;
  title: string;
  contentHtmlRaw: string;
  excerptHtmlRaw: string;
  sourceLink: string;
  publishedAtGmt: Date | null;
  modifiedAtGmt: Date | null;
  categories: string[];
}

export interface PostCategoryWithCount {
  wpTermId: number;
  slug: string;
  name: string;
  description: string;
  postCount: number;
}

export interface PostArchiveBucket {
  month: string;
  label: string;
  year: number;
  monthNumber: number;
  postCount: number;
  after: string;
  before: string;
}

function buildPostWhereClause(input: {
  categorySlug?: string;
  after?: Date;
  before?: Date;
}): SQL<unknown> {
  const db = getDb();
  const clauses: SQL<unknown>[] = [eq(blogPosts.status, 'publish')];

  if (input.categorySlug) {
    clauses.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(blogPostTerms)
          .innerJoin(blogTerms, eq(blogPostTerms.termId, blogTerms.id))
          .where(
            and(
              eq(blogPostTerms.postId, blogPosts.id),
              eq(blogTerms.taxonomy, 'category'),
              eq(blogTerms.slug, input.categorySlug)
            )
          )
      )
    );
  }

  if (input.after) {
    clauses.push(gte(blogPosts.publishedAtGmt, input.after));
  }

  if (input.before) {
    clauses.push(lte(blogPosts.publishedAtGmt, input.before));
  }

  return and(...clauses)!;
}

function getOrderBy(sort: PostSort) {
  switch (sort) {
    case 'published_asc':
      return [asc(blogPosts.publishedAtGmt), asc(blogPosts.id)] as const;
    case 'modified_desc':
      return [desc(blogPosts.modifiedAtGmt), desc(blogPosts.id)] as const;
    case 'modified_asc':
      return [asc(blogPosts.modifiedAtGmt), asc(blogPosts.id)] as const;
    case 'published_desc':
    default:
      return [desc(blogPosts.publishedAtGmt), desc(blogPosts.id)] as const;
  }
}

async function loadCategorySlugsByPostIds(postIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (postIds.length === 0) {
    return result;
  }

  const db = getDb();
  const rows = await db
    .select({
      postId: blogPostTerms.postId,
      slug: blogTerms.slug
    })
    .from(blogPostTerms)
    .innerJoin(blogTerms, eq(blogPostTerms.termId, blogTerms.id))
    .where(and(inArray(blogPostTerms.postId, postIds), eq(blogTerms.taxonomy, 'category')));

  for (const row of rows) {
    const existing = result.get(row.postId) ?? [];
    existing.push(row.slug);
    result.set(row.postId, existing);
  }

  return result;
}

export async function listPosts(input: ListPostsInput): Promise<{
  total: number;
  page: number;
  pageSize: number;
  items: PostListItem[];
}> {
  const db = getDb();
  const whereClause = buildPostWhereClause(input);
  const offset = (input.page - 1) * input.pageSize;

  const [countRow] = await db.select({ value: sql<number>`count(*)` }).from(blogPosts).where(whereClause);
  const total = Number(countRow?.value ?? 0);

  const postRows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerptHtmlRaw: blogPosts.excerptHtmlRaw,
      sourceLink: blogPosts.sourceLink,
      publishedAtGmt: blogPosts.publishedAtGmt,
      modifiedAtGmt: blogPosts.modifiedAtGmt
    })
    .from(blogPosts)
    .where(whereClause)
    .orderBy(...getOrderBy(input.sort))
    .limit(input.pageSize)
    .offset(offset);

  const categoryMap = await loadCategorySlugsByPostIds(postRows.map((row) => row.id));

  const items: PostListItem[] = postRows.map((row) => ({
    ...row,
    categories: categoryMap.get(row.id) ?? []
  }));

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    items
  };
}

export async function getPostBySlug(slug: string): Promise<PostDetailItem | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      contentHtmlRaw: blogPosts.contentHtmlRaw,
      excerptHtmlRaw: blogPosts.excerptHtmlRaw,
      sourceLink: blogPosts.sourceLink,
      publishedAtGmt: blogPosts.publishedAtGmt,
      modifiedAtGmt: blogPosts.modifiedAtGmt
    })
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'publish')))
    .limit(1);

  if (!row) {
    return null;
  }

  const categoryMap = await loadCategorySlugsByPostIds([row.id]);

  return {
    ...row,
    categories: categoryMap.get(row.id) ?? []
  };
}

export async function listPostCategories(): Promise<PostCategoryWithCount[]> {
  const db = getDb();

  const rows = await db
    .select({
      wpTermId: blogTerms.wpTermId,
      slug: blogTerms.slug,
      name: blogTerms.name,
      description: blogTerms.description,
      postCount: countDistinct(blogPosts.id)
    })
    .from(blogTerms)
    .leftJoin(blogPostTerms, eq(blogPostTerms.termId, blogTerms.id))
    .leftJoin(blogPosts, and(eq(blogPosts.id, blogPostTerms.postId), eq(blogPosts.status, 'publish')))
    .where(eq(blogTerms.taxonomy, 'category'))
    .groupBy(blogTerms.id)
    .orderBy(asc(blogTerms.name));

  return rows.map((row) => ({
    ...row,
    postCount: Number(row.postCount ?? 0)
  }));
}

function getMonthBounds(year: number, monthNumber: number): { after: Date; before: Date } {
  const after = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const before = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { after, before };
}

export async function listPostArchives(input?: { categorySlug?: string }): Promise<PostArchiveBucket[]> {
  const db = getDb();

  const whereClause = buildPostWhereClause({
    categorySlug: input?.categorySlug
  });

  const yearExpr = sql<number>`extract(year from ${blogPosts.publishedAtGmt})::int`;
  const monthExpr = sql<number>`extract(month from ${blogPosts.publishedAtGmt})::int`;

  const rows = await db
    .select({
      year: yearExpr,
      monthNumber: monthExpr,
      postCount: sql<number>`count(distinct ${blogPosts.id})`
    })
    .from(blogPosts)
    .where(and(whereClause, sql`${blogPosts.publishedAtGmt} is not null`))
    .groupBy(yearExpr, monthExpr)
    .orderBy(desc(yearExpr), desc(monthExpr));

  return rows.map((row) => {
    const year = Number(row.year);
    const monthNumber = Number(row.monthNumber);
    const { after, before } = getMonthBounds(year, monthNumber);

    return {
      month: `${String(year)}-${String(monthNumber).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(after),
      year,
      monthNumber,
      postCount: Number(row.postCount ?? 0),
      after: after.toISOString(),
      before: before.toISOString()
    };
  });
}
