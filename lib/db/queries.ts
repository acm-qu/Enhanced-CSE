import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  exists,
  inArray,
  sql,
  type SQL
} from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { wikiArticleTerms, wikiArticles, wikiSyncRuns, wikiSyncState, wikiTerms } from '@/lib/db/schema';

export type ArticleSort = 'modified_desc' | 'modified_asc' | 'published_desc' | 'published_asc';

export interface ListArticlesInput {
  page: number;
  pageSize: number;
  categorySlug?: string;
  tagSlug?: string;
  sort: ArticleSort;
}

export interface ArticleListItem {
  id: number;
  slug: string;
  title: string;
  contentHtmlRaw: string;
  excerptHtmlRaw: string;
  sourceLink: string;
  publishedAtGmt: Date | null;
  modifiedAtGmt: Date | null;
  categories: string[];
  tags: string[];
}

export interface ArticleDetailItem {
  id: number;
  slug: string;
  title: string;
  contentHtmlRaw: string;
  excerptHtmlRaw: string;
  sourceLink: string;
  publishedAtGmt: Date | null;
  modifiedAtGmt: Date | null;
  categories: string[];
  tags: string[];
}

export interface TermWithCount {
  wpTermId: number;
  slug: string;
  name: string;
  description: string;
  articleCount: number;
}

export interface SyncMeta {
  hasTags: boolean;
  lastSuccessAt: Date | null;
  lastRunStatus: 'running' | 'success' | 'failed' | null;
}

export interface SyncStatus {
  state: {
    hasTags: boolean;
    lastSuccessAt: Date | null;
    lastAttemptAt: Date | null;
    lastRunId: number | null;
  };
  latestRun: {
    id: number;
    startedAt: Date;
    finishedAt: Date | null;
    status: 'running' | 'success' | 'failed';
    mode: string;
    fetchedArticles: number;
    upsertedArticles: number;
    deletedArticles: number;
    fetchedPosts: number;
    upsertedPosts: number;
    deletedPosts: number;
    errorJson: unknown;
  } | null;
}

function buildArticleWhereClause(input: { categorySlug?: string; tagSlug?: string }): SQL<unknown> | undefined {
  const db = getDb();
  const clauses: SQL<unknown>[] = [eq(wikiArticles.status, 'publish')];

  if (input.categorySlug) {
    clauses.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(wikiArticleTerms)
          .innerJoin(wikiTerms, eq(wikiArticleTerms.termId, wikiTerms.id))
          .where(
            and(
              eq(wikiArticleTerms.articleId, wikiArticles.id),
              eq(wikiTerms.taxonomy, 'category'),
              eq(wikiTerms.slug, input.categorySlug)
            )
          )
      )
    );
  }

  if (input.tagSlug) {
    clauses.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(wikiArticleTerms)
          .innerJoin(wikiTerms, eq(wikiArticleTerms.termId, wikiTerms.id))
          .where(
            and(
              eq(wikiArticleTerms.articleId, wikiArticles.id),
              eq(wikiTerms.taxonomy, 'tag'),
              eq(wikiTerms.slug, input.tagSlug)
            )
          )
      )
    );
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

function getOrderBy(sort: ArticleSort) {
  switch (sort) {
    case 'modified_asc':
      return [asc(wikiArticles.modifiedAtGmt), asc(wikiArticles.id)] as const;
    case 'published_desc':
      return [desc(wikiArticles.publishedAtGmt), desc(wikiArticles.id)] as const;
    case 'published_asc':
      return [asc(wikiArticles.publishedAtGmt), asc(wikiArticles.id)] as const;
    case 'modified_desc':
    default:
      return [desc(wikiArticles.modifiedAtGmt), desc(wikiArticles.id)] as const;
  }
}

async function loadTermSlugsByArticleIds(articleIds: number[]): Promise<Map<number, { categories: string[]; tags: string[] }>> {
  const result = new Map<number, { categories: string[]; tags: string[] }>();
  if (articleIds.length === 0) {
    return result;
  }

  const db = getDb();
  const rows = await db
    .select({
      articleId: wikiArticleTerms.articleId,
      taxonomy: wikiTerms.taxonomy,
      slug: wikiTerms.slug
    })
    .from(wikiArticleTerms)
    .innerJoin(wikiTerms, eq(wikiArticleTerms.termId, wikiTerms.id))
    .where(inArray(wikiArticleTerms.articleId, articleIds));

  for (const row of rows) {
    const current = result.get(row.articleId) ?? { categories: [], tags: [] };
    if (row.taxonomy === 'category') {
      current.categories.push(row.slug);
    } else {
      current.tags.push(row.slug);
    }
    result.set(row.articleId, current);
  }

  return result;
}

export async function listArticles(input: ListArticlesInput): Promise<{
  total: number;
  page: number;
  pageSize: number;
  items: ArticleListItem[];
}> {
  const db = getDb();
  const whereClause = buildArticleWhereClause(input);
  const offset = (input.page - 1) * input.pageSize;
  const [countRow] = await db
    .select({ value: sql<number>`count(*)` })
    .from(wikiArticles)
    .where(whereClause);

  const total = Number(countRow?.value ?? 0);

  const articleRows = await db
    .select({
      id: wikiArticles.id,
      slug: wikiArticles.slug,
      title: wikiArticles.title,
      contentHtmlRaw: wikiArticles.contentHtmlRaw,
      excerptHtmlRaw: wikiArticles.excerptHtmlRaw,
      sourceLink: wikiArticles.sourceLink,
      publishedAtGmt: wikiArticles.publishedAtGmt,
      modifiedAtGmt: wikiArticles.modifiedAtGmt
    })
    .from(wikiArticles)
    .where(whereClause)
    .orderBy(...getOrderBy(input.sort))
    .limit(input.pageSize)
    .offset(offset);

  const termMap = await loadTermSlugsByArticleIds(articleRows.map((row) => row.id));

  const items: ArticleListItem[] = articleRows.map((row) => {
    const terms = termMap.get(row.id) ?? { categories: [], tags: [] };
    return {
      ...row,
      categories: terms.categories,
      tags: terms.tags
    };
  });

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    items
  };
}

export async function getArticleBySlug(slug: string): Promise<ArticleDetailItem | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: wikiArticles.id,
      slug: wikiArticles.slug,
      title: wikiArticles.title,
      contentHtmlRaw: wikiArticles.contentHtmlRaw,
      excerptHtmlRaw: wikiArticles.excerptHtmlRaw,
      sourceLink: wikiArticles.sourceLink,
      publishedAtGmt: wikiArticles.publishedAtGmt,
      modifiedAtGmt: wikiArticles.modifiedAtGmt
    })
    .from(wikiArticles)
    .where(and(eq(wikiArticles.slug, slug), eq(wikiArticles.status, 'publish')))
    .limit(1);

  if (!row) {
    return null;
  }

  const termMap = await loadTermSlugsByArticleIds([row.id]);
  const terms = termMap.get(row.id) ?? { categories: [], tags: [] };

  return {
    ...row,
    categories: terms.categories,
    tags: terms.tags
  };
}

export async function listCategories(): Promise<TermWithCount[]> {
  const db = getDb();
  const rows = await db
    .select({
      wpTermId: wikiTerms.wpTermId,
      slug: wikiTerms.slug,
      name: wikiTerms.name,
      description: wikiTerms.description,
      articleCount: countDistinct(wikiArticles.id)
    })
    .from(wikiTerms)
    .leftJoin(wikiArticleTerms, eq(wikiArticleTerms.termId, wikiTerms.id))
    .leftJoin(wikiArticles, and(eq(wikiArticles.id, wikiArticleTerms.articleId), eq(wikiArticles.status, 'publish')))
    .where(eq(wikiTerms.taxonomy, 'category'))
    .groupBy(wikiTerms.id)
    .orderBy(asc(wikiTerms.name));

  return rows.map((row) => ({
    ...row,
    articleCount: Number(row.articleCount ?? 0)
  }));
}

export async function listTags(): Promise<TermWithCount[]> {
  const db = getDb();

  const [state] = await db.select({ hasTags: wikiSyncState.hasTagsTaxonomy }).from(wikiSyncState).where(eq(wikiSyncState.id, 1)).limit(1);
  if (!state?.hasTags) {
    return [];
  }

  const rows = await db
    .select({
      wpTermId: wikiTerms.wpTermId,
      slug: wikiTerms.slug,
      name: wikiTerms.name,
      description: wikiTerms.description,
      articleCount: countDistinct(wikiArticles.id)
    })
    .from(wikiTerms)
    .leftJoin(wikiArticleTerms, eq(wikiArticleTerms.termId, wikiTerms.id))
    .leftJoin(wikiArticles, and(eq(wikiArticles.id, wikiArticleTerms.articleId), eq(wikiArticles.status, 'publish')))
    .where(eq(wikiTerms.taxonomy, 'tag'))
    .groupBy(wikiTerms.id)
    .orderBy(asc(wikiTerms.name));

  return rows.map((row) => ({
    ...row,
    articleCount: Number(row.articleCount ?? 0)
  }));
}

export async function getSyncMeta(): Promise<SyncMeta> {
  const db = getDb();
  const [state] = await db
    .select({
      hasTags: wikiSyncState.hasTagsTaxonomy,
      lastSuccessAt: wikiSyncState.lastSuccessAt
    })
    .from(wikiSyncState)
    .where(eq(wikiSyncState.id, 1))
    .limit(1);

  const [latestRun] = await db.select({ status: wikiSyncRuns.status }).from(wikiSyncRuns).orderBy(desc(wikiSyncRuns.id)).limit(1);

  return {
    hasTags: state?.hasTags ?? false,
    lastSuccessAt: state?.lastSuccessAt ?? null,
    lastRunStatus: latestRun?.status ?? null
  };
}

export async function listAllArticleSlugs(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ slug: wikiArticles.slug })
    .from(wikiArticles)
    .where(eq(wikiArticles.status, 'publish'));
  return rows.map((r) => r.slug);
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const db = getDb();
  const [stateRow] = await db
    .select({
      hasTags: wikiSyncState.hasTagsTaxonomy,
      lastSuccessAt: wikiSyncState.lastSuccessAt,
      lastAttemptAt: wikiSyncState.lastAttemptAt,
      lastRunId: wikiSyncState.lastRunId
    })
    .from(wikiSyncState)
    .where(eq(wikiSyncState.id, 1))
    .limit(1);

  const [latestRun] = await db
    .select({
      id: wikiSyncRuns.id,
      startedAt: wikiSyncRuns.startedAt,
      finishedAt: wikiSyncRuns.finishedAt,
      status: wikiSyncRuns.status,
      mode: wikiSyncRuns.mode,
      fetchedArticles: wikiSyncRuns.fetchedArticles,
      upsertedArticles: wikiSyncRuns.upsertedArticles,
      deletedArticles: wikiSyncRuns.deletedArticles,
      fetchedPosts: wikiSyncRuns.fetchedPosts,
      upsertedPosts: wikiSyncRuns.upsertedPosts,
      deletedPosts: wikiSyncRuns.deletedPosts,
      errorJson: wikiSyncRuns.errorJson
    })
    .from(wikiSyncRuns)
    .orderBy(desc(wikiSyncRuns.id))
    .limit(1);

  return {
    state: {
      hasTags: stateRow?.hasTags ?? false,
      lastSuccessAt: stateRow?.lastSuccessAt ?? null,
      lastAttemptAt: stateRow?.lastAttemptAt ?? null,
      lastRunId: stateRow?.lastRunId ?? null
    },
    latestRun: latestRun ?? null
  };
}


