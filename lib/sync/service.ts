import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import postgres from 'postgres';

import { getDb } from '@/lib/db/client';
import {
  blogPostTerms,
  blogPosts,
  blogTerms,
  wikiArticleTerms,
  wikiArticles,
  wikiSyncRuns,
  wikiSyncState,
  wikiTerms
} from '@/lib/db/schema';
import { getWpPostType } from '@/lib/internal/env';
import { log } from '@/lib/internal/log';
import {
  discoverTaxonomies,
  fetchAllTerms,
  fetchAllWikiArticles,
  fetchAllWpCategories,
  fetchAllWpPosts,
  type WpArticleResponse,
  type WpBlogPostResponse,
  type WpTermResponse
} from '@/lib/wp/client';
import { invalidateApiCache } from '@/lib/internal/api-cache';
import { revalidateTag } from 'next/cache';
import { WIKI_CACHE_TAG, POSTS_CACHE_TAG } from '@/lib/db/cached-queries';
import { decodeFetchedHtml } from '@/lib/sync/entities';

const ADVISORY_LOCK_KEY = 773_081;

type SyncTrigger = 'manual' | 'cron';

interface WikiSyncPhaseResult {
  fetchedArticles: number;
  upsertedArticles: number;
  deletedArticles: number;
  hasTagsTaxonomy: boolean;
}

interface PostsSyncPhaseResult {
  fetchedPosts: number;
  upsertedPosts: number;
  deletedPosts: number;
}

export interface SyncRunResult {
  status: 'success' | 'skipped';
  trigger: SyncTrigger;
  runId: number | null;
  fetchedArticles: number;
  upsertedArticles: number;
  deletedArticles: number;
  fetchedPosts: number;
  upsertedPosts: number;
  deletedPosts: number;
  hasTagsTaxonomy: boolean;
  reason?: string;
}

function parseDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseTermIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: number[] = [];
  for (const item of value) {
    const n = Number(item);
    if (Number.isInteger(n)) {
      ids.push(n);
    }
  }

  return ids;
}

function normalizeWpTerm(term: WpTermResponse, taxonomy: 'category' | 'tag') {
  return {
    wpTermId: term.id,
    taxonomy,
    slug: term.slug,
    name: term.name,
    description: term.description ?? '',
    parentWpTermId: term.parent ?? null,
    updatedAt: new Date()
  } as const;
}

function normalizeWpArticle(article: WpArticleResponse) {
  return {
    wpId: article.id,
    slug: article.slug,
    title: decodeFetchedHtml(article.title?.rendered ?? article.slug),
    contentHtmlRaw: decodeFetchedHtml(article.content?.rendered ?? ''),
    excerptHtmlRaw: decodeFetchedHtml(article.excerpt?.rendered ?? ''),
    sourceLink: article.link,
    publishedAtGmt: parseDateOrNull(article.date_gmt),
    modifiedAtGmt: parseDateOrNull(article.modified_gmt),
    status: article.status ?? 'publish',
    updatedAt: new Date()
  } as const;
}

function normalizeWpCategory(term: WpTermResponse) {
  return {
    wpTermId: term.id,
    taxonomy: 'category' as const,
    slug: term.slug,
    name: term.name,
    description: term.description ?? '',
    parentWpTermId: term.parent ?? null,
    updatedAt: new Date()
  };
}

function normalizeWpPost(post: WpBlogPostResponse) {
  return {
    wpId: post.id,
    slug: post.slug,
    title: decodeFetchedHtml(post.title?.rendered ?? post.slug),
    contentHtmlRaw: decodeFetchedHtml(post.content?.rendered ?? ''),
    excerptHtmlRaw: decodeFetchedHtml(post.excerpt?.rendered ?? ''),
    sourceLink: post.link,
    publishedAtGmt: parseDateOrNull(post.date_gmt),
    modifiedAtGmt: parseDateOrNull(post.modified_gmt),
    status: post.status ?? 'publish',
    updatedAt: new Date()
  };
}

function toErrorJson(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function toPgBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return normalized === 't' || normalized === 'true' || normalized === '1';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

async function withAdvisoryLock<T>(operation: () => Promise<T>): Promise<{ acquired: false } | { acquired: true; result: T }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const lockClient = postgres(databaseUrl, {
    max: 1,
    prepare: false
  });

  try {
    const lockRows = await lockClient<{ locked: boolean }[]>`select pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) as locked`;
    const acquired = toPgBoolean(lockRows[0]?.locked);
    if (!acquired) {
      return { acquired: false };
    }

    try {
      const result = await operation();
      return { acquired: true, result };
    } finally {
      await lockClient`select pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
    }
  } finally {
    await lockClient.end({ timeout: 5 });
  }
}

async function upsertStateAttempt(runId: number): Promise<void> {
  const db = getDb();
  const now = new Date();

  await db
    .insert(wikiSyncState)
    .values({
      id: 1,
      lastAttemptAt: now,
      lastRunId: runId
    })
    .onConflictDoUpdate({
      target: wikiSyncState.id,
      set: {
        lastAttemptAt: now,
        lastRunId: runId
      }
    });
}

async function syncWikiPhase(params: { runId: number; trigger: SyncTrigger }): Promise<WikiSyncPhaseResult> {
  const db = getDb();
  const postType = getWpPostType();
  const discovery = await discoverTaxonomies(postType);
  const hasTagsTaxonomy = Boolean(discovery.tagTaxonomy);

  const categoryTerms = await fetchAllTerms(discovery.categoryTaxonomy);
  const tagTerms = discovery.tagTaxonomy ? await fetchAllTerms(discovery.tagTaxonomy) : [];
  const articles = await fetchAllWikiArticles(postType);

  log('info', 'sync.wiki.fetch_complete', {
    run_id: params.runId,
    trigger: params.trigger,
    post_type: postType,
    category_taxonomy: discovery.categoryTaxonomy,
    tag_taxonomy: discovery.tagTaxonomy,
    category_terms: categoryTerms.length,
    tag_terms: tagTerms.length,
    articles: articles.length
  });

  const now = new Date();

  return db.transaction(async (tx) => {
    const normalizedCategories = categoryTerms.map((term) => normalizeWpTerm(term, 'category'));
    if (normalizedCategories.length > 0) {
      await tx
        .insert(wikiTerms)
        .values(normalizedCategories)
        .onConflictDoUpdate({
          target: wikiTerms.wpTermId,
          set: {
            taxonomy: sql`excluded.taxonomy`,
            slug: sql`excluded.slug`,
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            parentWpTermId: sql`excluded.parent_wp_term_id`,
            updatedAt: now
          }
        });
    }

    const normalizedTags = tagTerms.map((term) => normalizeWpTerm(term, 'tag'));
    if (normalizedTags.length > 0) {
      await tx
        .insert(wikiTerms)
        .values(normalizedTags)
        .onConflictDoUpdate({
          target: wikiTerms.wpTermId,
          set: {
            taxonomy: sql`excluded.taxonomy`,
            slug: sql`excluded.slug`,
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            parentWpTermId: sql`excluded.parent_wp_term_id`,
            updatedAt: now
          }
        });
    }

    const categoryWpIds = normalizedCategories.map((term) => term.wpTermId);
    if (categoryWpIds.length > 0) {
      await tx.delete(wikiTerms).where(and(eq(wikiTerms.taxonomy, 'category'), notInArray(wikiTerms.wpTermId, categoryWpIds)));
    } else {
      await tx.delete(wikiTerms).where(eq(wikiTerms.taxonomy, 'category'));
    }

    const tagWpIds = normalizedTags.map((term) => term.wpTermId);
    if (hasTagsTaxonomy) {
      if (tagWpIds.length > 0) {
        await tx.delete(wikiTerms).where(and(eq(wikiTerms.taxonomy, 'tag'), notInArray(wikiTerms.wpTermId, tagWpIds)));
      } else {
        await tx.delete(wikiTerms).where(eq(wikiTerms.taxonomy, 'tag'));
      }
    } else {
      await tx.delete(wikiTerms).where(eq(wikiTerms.taxonomy, 'tag'));
    }

    const normalizedArticles = articles.map(normalizeWpArticle);
    let articleRows: Array<{ id: number; wpId: number }> = [];

    if (normalizedArticles.length > 0) {
      articleRows = await tx
        .insert(wikiArticles)
        .values(normalizedArticles)
        .onConflictDoUpdate({
          target: wikiArticles.wpId,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            contentHtmlRaw: sql`excluded.content_html_raw`,
            excerptHtmlRaw: sql`excluded.excerpt_html_raw`,
            sourceLink: sql`excluded.source_link`,
            publishedAtGmt: sql`excluded.published_at_gmt`,
            modifiedAtGmt: sql`excluded.modified_at_gmt`,
            status: sql`excluded.status`,
            updatedAt: now
          }
        })
        .returning({ id: wikiArticles.id, wpId: wikiArticles.wpId });
    }

    const wpToLocalArticleId = new Map<number, number>();
    for (const row of articleRows) {
      wpToLocalArticleId.set(row.wpId, row.id);
    }

    const seenWpIds = normalizedArticles.map((article) => article.wpId);
    const missingWpIds = seenWpIds.filter((wpId) => !wpToLocalArticleId.has(wpId));
    if (missingWpIds.length > 0) {
      const fallbackRows = await tx.select({ id: wikiArticles.id, wpId: wikiArticles.wpId }).from(wikiArticles).where(inArray(wikiArticles.wpId, missingWpIds));
      for (const row of fallbackRows) {
        wpToLocalArticleId.set(row.wpId, row.id);
      }
    }

    const termRows = await tx.select({ id: wikiTerms.id, wpTermId: wikiTerms.wpTermId }).from(wikiTerms);

    const wpToLocalTermId = new Map<number, number>();
    for (const row of termRows) {
      wpToLocalTermId.set(row.wpTermId, row.id);
    }

    const seenLocalArticleIds = Array.from(wpToLocalArticleId.values());
    if (seenLocalArticleIds.length > 0) {
      await tx.delete(wikiArticleTerms).where(inArray(wikiArticleTerms.articleId, seenLocalArticleIds));
    }

    const joinRows: Array<{ articleId: number; termId: number }> = [];
    const relationKey = new Set<string>();

    for (const sourceArticle of articles) {
      const localArticleId = wpToLocalArticleId.get(sourceArticle.id);
      if (!localArticleId) {
        continue;
      }

      const categoryTermWpIds = parseTermIds(sourceArticle[discovery.categoryTaxonomy]);
      const tagTermWpIds = discovery.tagTaxonomy ? parseTermIds(sourceArticle[discovery.tagTaxonomy]) : [];

      for (const wpTermId of categoryTermWpIds.concat(tagTermWpIds)) {
        const localTermId = wpToLocalTermId.get(wpTermId);
        if (!localTermId) {
          continue;
        }

        const key = `${localArticleId}:${localTermId}`;
        if (relationKey.has(key)) {
          continue;
        }

        relationKey.add(key);
        joinRows.push({ articleId: localArticleId, termId: localTermId });
      }
    }

    if (joinRows.length > 0) {
      await tx.insert(wikiArticleTerms).values(joinRows).onConflictDoNothing();
    }

    let deletedRows: Array<{ id: number }> = [];
    if (seenWpIds.length > 0) {
      deletedRows = await tx.delete(wikiArticles).where(notInArray(wikiArticles.wpId, seenWpIds)).returning({ id: wikiArticles.id });
    } else {
      deletedRows = await tx.delete(wikiArticles).returning({ id: wikiArticles.id });
    }

    return {
      fetchedArticles: articles.length,
      upsertedArticles: normalizedArticles.length,
      deletedArticles: deletedRows.length,
      hasTagsTaxonomy
    };
  });
}

async function syncPostsPhase(params: { runId: number; trigger: SyncTrigger }): Promise<PostsSyncPhaseResult> {
  const db = getDb();

  const categories = await fetchAllWpCategories();
  const posts = await fetchAllWpPosts();

  log('info', 'sync.posts.fetch_complete', {
    run_id: params.runId,
    trigger: params.trigger,
    categories: categories.length,
    posts: posts.length
  });

  const now = new Date();

  return db.transaction(async (tx) => {
    const normalizedCategories = categories.map(normalizeWpCategory);
    if (normalizedCategories.length > 0) {
      await tx
        .insert(blogTerms)
        .values(normalizedCategories)
        .onConflictDoUpdate({
          target: blogTerms.wpTermId,
          set: {
            taxonomy: sql`excluded.taxonomy`,
            slug: sql`excluded.slug`,
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            parentWpTermId: sql`excluded.parent_wp_term_id`,
            updatedAt: now
          }
        });
    }

    const categoryWpIds = normalizedCategories.map((term) => term.wpTermId);
    if (categoryWpIds.length > 0) {
      await tx.delete(blogTerms).where(and(eq(blogTerms.taxonomy, 'category'), notInArray(blogTerms.wpTermId, categoryWpIds)));
    } else {
      await tx.delete(blogTerms).where(eq(blogTerms.taxonomy, 'category'));
    }

    const normalizedPosts = posts.map(normalizeWpPost);
    let postRows: Array<{ id: number; wpId: number }> = [];

    if (normalizedPosts.length > 0) {
      postRows = await tx
        .insert(blogPosts)
        .values(normalizedPosts)
        .onConflictDoUpdate({
          target: blogPosts.wpId,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            contentHtmlRaw: sql`excluded.content_html_raw`,
            excerptHtmlRaw: sql`excluded.excerpt_html_raw`,
            sourceLink: sql`excluded.source_link`,
            publishedAtGmt: sql`excluded.published_at_gmt`,
            modifiedAtGmt: sql`excluded.modified_at_gmt`,
            status: sql`excluded.status`,
            updatedAt: now
          }
        })
        .returning({ id: blogPosts.id, wpId: blogPosts.wpId });
    }

    const wpToLocalPostId = new Map<number, number>();
    for (const row of postRows) {
      wpToLocalPostId.set(row.wpId, row.id);
    }

    const seenWpIds = normalizedPosts.map((post) => post.wpId);
    const missingWpIds = seenWpIds.filter((wpId) => !wpToLocalPostId.has(wpId));
    if (missingWpIds.length > 0) {
      const fallbackRows = await tx.select({ id: blogPosts.id, wpId: blogPosts.wpId }).from(blogPosts).where(inArray(blogPosts.wpId, missingWpIds));
      for (const row of fallbackRows) {
        wpToLocalPostId.set(row.wpId, row.id);
      }
    }

    const termRows = await tx.select({ id: blogTerms.id, wpTermId: blogTerms.wpTermId }).from(blogTerms);

    const wpToLocalTermId = new Map<number, number>();
    for (const row of termRows) {
      wpToLocalTermId.set(row.wpTermId, row.id);
    }

    const seenLocalPostIds = Array.from(wpToLocalPostId.values());
    if (seenLocalPostIds.length > 0) {
      await tx.delete(blogPostTerms).where(inArray(blogPostTerms.postId, seenLocalPostIds));
    }

    const joinRows: Array<{ postId: number; termId: number }> = [];
    const relationKey = new Set<string>();

    for (const sourcePost of posts) {
      const localPostId = wpToLocalPostId.get(sourcePost.id);
      if (!localPostId) {
        continue;
      }

      const categoryWpTermIds = parseTermIds(sourcePost.categories);
      for (const wpTermId of categoryWpTermIds) {
        const localTermId = wpToLocalTermId.get(wpTermId);
        if (!localTermId) {
          continue;
        }

        const key = `${localPostId}:${localTermId}`;
        if (relationKey.has(key)) {
          continue;
        }

        relationKey.add(key);
        joinRows.push({ postId: localPostId, termId: localTermId });
      }
    }

    if (joinRows.length > 0) {
      await tx.insert(blogPostTerms).values(joinRows).onConflictDoNothing();
    }

    let deletedRows: Array<{ id: number }> = [];
    if (seenWpIds.length > 0) {
      deletedRows = await tx.delete(blogPosts).where(notInArray(blogPosts.wpId, seenWpIds)).returning({ id: blogPosts.id });
    } else {
      deletedRows = await tx.delete(blogPosts).returning({ id: blogPosts.id });
    }

    return {
      fetchedPosts: posts.length,
      upsertedPosts: normalizedPosts.length,
      deletedPosts: deletedRows.length
    };
  });
}

export async function runFullSync(trigger: SyncTrigger): Promise<SyncRunResult> {
  const db = getDb();
  let runId: number | null = null;

  try {
    const lockedResult = await withAdvisoryLock<SyncRunResult>(async (): Promise<SyncRunResult> => {
      const [createdRun] = await db
        .insert(wikiSyncRuns)
        .values({
          status: 'running',
          mode: 'full',
          startedAt: new Date()
        })
        .returning({ id: wikiSyncRuns.id });

      if (!createdRun) {
        throw new Error('Failed to create sync run');
      }

      const activeRunId = createdRun.id;
      runId = activeRunId;
      await upsertStateAttempt(activeRunId);

      const wikiPhase = await syncWikiPhase({ runId: activeRunId, trigger });
      const postsPhase = await syncPostsPhase({ runId: activeRunId, trigger });
      const now = new Date();

      await db
        .update(wikiSyncRuns)
        .set({
          finishedAt: now,
          status: 'success',
          fetchedArticles: wikiPhase.fetchedArticles,
          upsertedArticles: wikiPhase.upsertedArticles,
          deletedArticles: wikiPhase.deletedArticles,
          fetchedPosts: postsPhase.fetchedPosts,
          upsertedPosts: postsPhase.upsertedPosts,
          deletedPosts: postsPhase.deletedPosts,
          errorJson: null
        })
        .where(eq(wikiSyncRuns.id, activeRunId));

      await db
        .insert(wikiSyncState)
        .values({
          id: 1,
          hasTagsTaxonomy: wikiPhase.hasTagsTaxonomy,
          lastSuccessAt: now,
          lastAttemptAt: now,
          lastRunId: activeRunId
        })
        .onConflictDoUpdate({
          target: wikiSyncState.id,
          set: {
            hasTagsTaxonomy: wikiPhase.hasTagsTaxonomy,
            lastSuccessAt: now,
            lastAttemptAt: now,
            lastRunId: activeRunId
          }
        });

      log('info', 'sync.success', {
        run_id: activeRunId,
        trigger,
        fetched_articles: wikiPhase.fetchedArticles,
        upserted_articles: wikiPhase.upsertedArticles,
        deleted_articles: wikiPhase.deletedArticles,
        fetched_posts: postsPhase.fetchedPosts,
        upserted_posts: postsPhase.upsertedPosts,
        deleted_posts: postsPhase.deletedPosts,
        has_tags_taxonomy: wikiPhase.hasTagsTaxonomy
      });

      await invalidateApiCache();
      revalidateTag(WIKI_CACHE_TAG, 'default');
      revalidateTag(POSTS_CACHE_TAG, 'default');

      return {
        status: 'success',
        trigger,
        runId: activeRunId,
        fetchedArticles: wikiPhase.fetchedArticles,
        upsertedArticles: wikiPhase.upsertedArticles,
        deletedArticles: wikiPhase.deletedArticles,
        fetchedPosts: postsPhase.fetchedPosts,
        upsertedPosts: postsPhase.upsertedPosts,
        deletedPosts: postsPhase.deletedPosts,
        hasTagsTaxonomy: wikiPhase.hasTagsTaxonomy
      };
    });

    if (!lockedResult.acquired) {
      return {
        status: 'skipped',
        trigger,
        runId: null,
        fetchedArticles: 0,
        upsertedArticles: 0,
        deletedArticles: 0,
        fetchedPosts: 0,
        upsertedPosts: 0,
        deletedPosts: 0,
        hasTagsTaxonomy: false,
        reason: 'sync_already_running'
      };
    }

    return lockedResult.result;
  } catch (error) {
    if (runId !== null) {
      const now = new Date();
      const errorJson = toErrorJson(error);

      await db
        .update(wikiSyncRuns)
        .set({
          finishedAt: now,
          status: 'failed',
          errorJson
        })
        .where(eq(wikiSyncRuns.id, runId));

      await db
        .insert(wikiSyncState)
        .values({
          id: 1,
          lastAttemptAt: now,
          lastRunId: runId
        })
        .onConflictDoUpdate({
          target: wikiSyncState.id,
          set: {
            lastAttemptAt: now,
            lastRunId: runId
          }
        });
    }

    log('error', 'sync.failed', {
      run_id: runId,
      trigger,
      error: toErrorJson(error)
    });

    throw error;
  }
}
