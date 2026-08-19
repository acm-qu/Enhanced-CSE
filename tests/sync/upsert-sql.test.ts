import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { blogPosts, wikiArticles } from '@/lib/db/schema';

// postgres-js connects lazily, so building a client here never opens a socket.
// toSQL() renders the statement without executing it.
const client = postgres('postgresql://user:pass@127.0.0.1:5432/never-connected', { prepare: false });
const db = drizzle(client);

const now = new Date('2026-01-01T00:00:00Z');

function articleUpsertSql() {
  return db
    .insert(wikiArticles)
    .values([
      {
        wpId: 1,
        slug: 'a',
        title: 'A',
        contentHtmlRaw: '<p>a</p>',
        excerptHtmlRaw: '',
        sourceLink: 'http://example.com/a',
        publishedAtGmt: now,
        modifiedAtGmt: now,
        status: 'publish'
      }
    ])
    .onConflictDoUpdate({
      target: wikiArticles.wpId,
      set: { title: sql`excluded.title`, updatedAt: now },
      setWhere: sql`${wikiArticles.title} is distinct from excluded.title`
    })
    .returning({ id: wikiArticles.id, wpId: wikiArticles.wpId, inserted: sql<boolean>`(xmax = 0)` })
    .toSQL();
}

describe('incremental upsert SQL', () => {
  it('puts the guard on DO UPDATE, not on the conflict target', () => {
    const { sql: text } = articleUpsertSql();

    // The WHERE must follow DO UPDATE SET so it filters which rows are
    // rewritten. If it landed after ON CONFLICT (...) it would instead be a
    // partial-index predicate and would not skip unchanged rows.
    const doUpdateAt = text.indexOf('do update set');
    const whereAt = text.indexOf('is distinct from');

    expect(doUpdateAt).toBeGreaterThan(-1);
    expect(whereAt).toBeGreaterThan(doUpdateAt);
    expect(text).toMatch(/do update set .* where .*is distinct from/i);
  });

  it('compares the target column against excluded', () => {
    const { sql: text } = articleUpsertSql();
    expect(text).toContain('"wiki_articles"."title" is distinct from excluded.title');
  });

  it('returns the xmax insert marker unqualified', () => {
    const { sql: text } = articleUpsertSql();
    // Must stay bare `xmax`; a table-qualified form would not be a valid
    // reference to the system column in RETURNING.
    expect(text).toMatch(/returning .*\(xmax = 0\)/i);
    expect(text).not.toMatch(/"wiki_articles"\."xmax"/);
  });

  it('renders the same shape for blog posts', () => {
    const { sql: text } = db
      .insert(blogPosts)
      .values([
        {
          wpId: 1,
          slug: 'p',
          title: 'P',
          contentHtmlRaw: '<p>p</p>',
          excerptHtmlRaw: '',
          sourceLink: 'http://example.com/p',
          publishedAtGmt: now,
          modifiedAtGmt: now,
          status: 'publish'
        }
      ])
      .onConflictDoUpdate({
        target: blogPosts.wpId,
        set: { title: sql`excluded.title`, updatedAt: now },
        setWhere: sql`${blogPosts.title} is distinct from excluded.title`
      })
      .returning({ id: blogPosts.id, inserted: sql<boolean>`(xmax = 0)` })
      .toSQL();

    expect(text).toMatch(/do update set .* where .*is distinct from/i);
    expect(text).toContain('"blog_posts"."title" is distinct from excluded.title');
  });
});
