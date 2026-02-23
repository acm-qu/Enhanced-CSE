CREATE TYPE "blog_taxonomy" AS ENUM ('category');

ALTER TABLE "wiki_sync_runs"
  ADD COLUMN IF NOT EXISTS "fetched_posts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "upserted_posts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deleted_posts" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "blog_posts" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_wp_id_uq" ON "blog_posts" ("wp_id");
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_uq" ON "blog_posts" ("slug");
CREATE INDEX IF NOT EXISTS "blog_posts_slug_idx" ON "blog_posts" ("slug");
CREATE INDEX IF NOT EXISTS "blog_posts_published_at_gmt_idx" ON "blog_posts" ("published_at_gmt");
CREATE INDEX IF NOT EXISTS "blog_posts_modified_at_gmt_idx" ON "blog_posts" ("modified_at_gmt");
CREATE INDEX IF NOT EXISTS "blog_posts_status_published_idx" ON "blog_posts" ("status", "published_at_gmt");

CREATE TABLE IF NOT EXISTS "blog_terms" (
  "id" serial PRIMARY KEY,
  "wp_term_id" integer NOT NULL,
  "taxonomy" "blog_taxonomy" NOT NULL,
  "slug" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "parent_wp_term_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_terms_wp_term_id_uq" ON "blog_terms" ("wp_term_id");
CREATE INDEX IF NOT EXISTS "blog_terms_taxonomy_slug_idx" ON "blog_terms" ("taxonomy", "slug");

CREATE TABLE IF NOT EXISTS "blog_post_terms" (
  "post_id" integer NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
  "term_id" integer NOT NULL REFERENCES "blog_terms"("id") ON DELETE CASCADE,
  CONSTRAINT "blog_post_terms_pk" PRIMARY KEY ("post_id", "term_id")
);

CREATE INDEX IF NOT EXISTS "blog_post_terms_term_post_idx" ON "blog_post_terms" ("term_id", "post_id");
