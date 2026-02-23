CREATE TYPE "wiki_taxonomy" AS ENUM ('category', 'tag');
CREATE TYPE "wiki_sync_status" AS ENUM ('running', 'success', 'failed');

CREATE TABLE IF NOT EXISTS "wiki_articles" (
  "id" serial PRIMARY KEY,
  "wp_id" integer NOT NULL,
  "slug" varchar(255) NOT NULL,
  "title" text NOT NULL,
  "content_html_raw" text NOT NULL,
  "excerpt_html_raw" text NOT NULL DEFAULT '',
  "source_link" text NOT NULL,
  "published_at_gmt" timestamp with time zone,
  "modified_at_gmt" timestamp with time zone,
  "status" varchar(50) NOT NULL DEFAULT 'publish',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_articles_wp_id_uq" ON "wiki_articles" ("wp_id");
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_articles_slug_uq" ON "wiki_articles" ("slug");
CREATE INDEX IF NOT EXISTS "wiki_articles_slug_idx" ON "wiki_articles" ("slug");
CREATE INDEX IF NOT EXISTS "wiki_articles_modified_at_gmt_idx" ON "wiki_articles" ("modified_at_gmt");

CREATE TABLE IF NOT EXISTS "wiki_terms" (
  "id" serial PRIMARY KEY,
  "wp_term_id" integer NOT NULL,
  "taxonomy" "wiki_taxonomy" NOT NULL,
  "slug" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "parent_wp_term_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_terms_wp_term_id_uq" ON "wiki_terms" ("wp_term_id");
CREATE INDEX IF NOT EXISTS "wiki_terms_taxonomy_slug_idx" ON "wiki_terms" ("taxonomy", "slug");

CREATE TABLE IF NOT EXISTS "wiki_article_terms" (
  "article_id" integer NOT NULL REFERENCES "wiki_articles"("id") ON DELETE CASCADE,
  "term_id" integer NOT NULL REFERENCES "wiki_terms"("id") ON DELETE CASCADE,
  CONSTRAINT "wiki_article_terms_pk" PRIMARY KEY ("article_id", "term_id")
);

CREATE INDEX IF NOT EXISTS "wiki_article_terms_term_article_idx" ON "wiki_article_terms" ("term_id", "article_id");

CREATE TABLE IF NOT EXISTS "wiki_sync_runs" (
  "id" serial PRIMARY KEY,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone,
  "status" "wiki_sync_status" NOT NULL,
  "mode" varchar(20) NOT NULL DEFAULT 'full',
  "fetched_articles" integer NOT NULL DEFAULT 0,
  "upserted_articles" integer NOT NULL DEFAULT 0,
  "deleted_articles" integer NOT NULL DEFAULT 0,
  "error_json" jsonb
);

CREATE TABLE IF NOT EXISTS "wiki_sync_state" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "has_tags_taxonomy" boolean NOT NULL DEFAULT false,
  "last_success_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_run_id" integer REFERENCES "wiki_sync_runs"("id") ON DELETE SET NULL
);
