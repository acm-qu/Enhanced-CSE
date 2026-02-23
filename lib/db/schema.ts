import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core';

export const wikiTaxonomyEnum = pgEnum('wiki_taxonomy', ['category', 'tag']);
export const blogTaxonomyEnum = pgEnum('blog_taxonomy', ['category']);
export const wikiSyncStatusEnum = pgEnum('wiki_sync_status', ['running', 'success', 'failed']);

export const wikiArticles = pgTable(
  'wiki_articles',
  {
    id: serial('id').primaryKey(),
    wpId: integer('wp_id').notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    title: text('title').notNull(),
    contentHtmlRaw: text('content_html_raw').notNull(),
    excerptHtmlRaw: text('excerpt_html_raw').notNull().default(''),
    sourceLink: text('source_link').notNull(),
    publishedAtGmt: timestamp('published_at_gmt', { withTimezone: true }),
    modifiedAtGmt: timestamp('modified_at_gmt', { withTimezone: true }),
    status: varchar('status', { length: 50 }).notNull().default('publish'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    wpIdUq: uniqueIndex('wiki_articles_wp_id_uq').on(table.wpId),
    slugUq: uniqueIndex('wiki_articles_slug_uq').on(table.slug),
    slugIdx: index('wiki_articles_slug_idx').on(table.slug),
    modifiedDescIdx: index('wiki_articles_modified_at_gmt_idx').on(table.modifiedAtGmt)
  })
);

export const wikiTerms = pgTable(
  'wiki_terms',
  {
    id: serial('id').primaryKey(),
    wpTermId: integer('wp_term_id').notNull(),
    taxonomy: wikiTaxonomyEnum('taxonomy').notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    parentWpTermId: integer('parent_wp_term_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    wpTermIdUq: uniqueIndex('wiki_terms_wp_term_id_uq').on(table.wpTermId),
    taxonomySlugIdx: index('wiki_terms_taxonomy_slug_idx').on(table.taxonomy, table.slug)
  })
);

export const wikiArticleTerms = pgTable(
  'wiki_article_terms',
  {
    articleId: integer('article_id')
      .notNull()
      .references(() => wikiArticles.id, { onDelete: 'cascade' }),
    termId: integer('term_id')
      .notNull()
      .references(() => wikiTerms.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.articleId, table.termId], name: 'wiki_article_terms_pk' }),
    termArticleIdx: index('wiki_article_terms_term_article_idx').on(table.termId, table.articleId)
  })
);

export const wikiSyncRuns = pgTable('wiki_sync_runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: wikiSyncStatusEnum('status').notNull(),
  mode: varchar('mode', { length: 20 }).notNull().default('full'),
  fetchedArticles: integer('fetched_articles').notNull().default(0),
  upsertedArticles: integer('upserted_articles').notNull().default(0),
  deletedArticles: integer('deleted_articles').notNull().default(0),
  fetchedPosts: integer('fetched_posts').notNull().default(0),
  upsertedPosts: integer('upserted_posts').notNull().default(0),
  deletedPosts: integer('deleted_posts').notNull().default(0),
  errorJson: jsonb('error_json')
});

export const blogPosts = pgTable(
  'blog_posts',
  {
    id: serial('id').primaryKey(),
    wpId: integer('wp_id').notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    title: text('title').notNull(),
    contentHtmlRaw: text('content_html_raw').notNull(),
    excerptHtmlRaw: text('excerpt_html_raw').notNull().default(''),
    sourceLink: text('source_link').notNull(),
    publishedAtGmt: timestamp('published_at_gmt', { withTimezone: true }),
    modifiedAtGmt: timestamp('modified_at_gmt', { withTimezone: true }),
    status: varchar('status', { length: 50 }).notNull().default('publish'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    wpIdUq: uniqueIndex('blog_posts_wp_id_uq').on(table.wpId),
    slugUq: uniqueIndex('blog_posts_slug_uq').on(table.slug),
    slugIdx: index('blog_posts_slug_idx').on(table.slug),
    publishedDescIdx: index('blog_posts_published_at_gmt_idx').on(table.publishedAtGmt),
    modifiedDescIdx: index('blog_posts_modified_at_gmt_idx').on(table.modifiedAtGmt),
    statusPublishedIdx: index('blog_posts_status_published_idx').on(table.status, table.publishedAtGmt)
  })
);

export const blogTerms = pgTable(
  'blog_terms',
  {
    id: serial('id').primaryKey(),
    wpTermId: integer('wp_term_id').notNull(),
    taxonomy: blogTaxonomyEnum('taxonomy').notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    parentWpTermId: integer('parent_wp_term_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    wpTermIdUq: uniqueIndex('blog_terms_wp_term_id_uq').on(table.wpTermId),
    taxonomySlugIdx: index('blog_terms_taxonomy_slug_idx').on(table.taxonomy, table.slug)
  })
);

export const blogPostTerms = pgTable(
  'blog_post_terms',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    termId: integer('term_id')
      .notNull()
      .references(() => blogTerms.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.termId], name: 'blog_post_terms_pk' }),
    termPostIdx: index('blog_post_terms_term_post_idx').on(table.termId, table.postId)
  })
);

export const wikiSyncState = pgTable('wiki_sync_state', {
  id: integer('id').primaryKey().default(1),
  hasTagsTaxonomy: boolean('has_tags_taxonomy').notNull().default(false),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastRunId: integer('last_run_id').references(() => wikiSyncRuns.id, { onDelete: 'set null' })
});

export type WikiArticle = typeof wikiArticles.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type WikiTerm = typeof wikiTerms.$inferSelect;
export type BlogTerm = typeof blogTerms.$inferSelect;
export type WikiSyncRun = typeof wikiSyncRuns.$inferSelect;
export type WikiSyncState = typeof wikiSyncState.$inferSelect;
