import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toPostListResponse } from '@/lib/content/transform';
import { listPostArchives, listPostCategories, listPosts, type PostSort } from '@/lib/db/posts-queries';
import { getSyncMeta } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

const SORT_OPTIONS: Array<{ value: PostSort; label: string }> = [
  { value: 'published_desc', label: 'Newest published' },
  { value: 'published_asc', label: 'Oldest published' },
  { value: 'modified_desc', label: 'Recently updated' },
  { value: 'modified_asc', label: 'Oldest updated' }
];

interface SearchParamProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseSort(value: string | undefined): PostSort {
  if (!value) {
    return 'published_desc';
  }

  const found = SORT_OPTIONS.find((option) => option.value === value);
  return found?.value ?? 'published_desc';
}

function parseMonth(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [, monthRaw] = value.split('-');
  const month = Number(monthRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return undefined;
  }

  return value;
}

function monthToRange(month: string): { after: Date; before: Date } {
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);

  return {
    after: new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0)),
    before: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999))
  };
}

function buildPostsHref(options: {
  page?: number;
  sort: PostSort;
  category?: string;
  month?: string;
}): string {
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  if (options.sort !== 'published_desc') {
    params.set('sort', options.sort);
  }

  if (options.category) {
    params.set('category', options.category);
  }

  if (options.month) {
    params.set('month', options.month);
  }

  const query = params.toString();
  return query ? `/posts?${query}` : '/posts';
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(date);
}

export default async function PostsPage({ searchParams }: SearchParamProps) {
  const page = parsePositiveInt(getFirstParam(searchParams?.page), 1);
  const sort = parseSort(getFirstParam(searchParams?.sort));
  const category = getFirstParam(searchParams?.category)?.trim() || undefined;
  const month = parseMonth(getFirstParam(searchParams?.month));

  const monthRange = month ? monthToRange(month) : undefined;

  const [postData, categories, archives, syncMeta] = await Promise.all([
    listPosts({
      page,
      pageSize: PAGE_SIZE,
      categorySlug: category,
      after: monthRange?.after,
      before: monthRange?.before,
      sort
    }),
    listPostCategories(),
    listPostArchives({ categorySlug: category }),
    getSyncMeta()
  ]);

  const transformedItems = postData.items.map(toPostListResponse);
  const totalPages = Math.max(1, Math.ceil(postData.total / PAGE_SIZE));

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, item.name]));
  const activeArchive = archives.find((bucket) => bucket.month === month) ?? null;

  return (
    <main className="content-shell">
      <section className="panel px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-2">Blog</Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Articles</h1>
            <p className="mt-2 text-sm text-foreground/70">
              Main-site posts with category and archive navigation. Last sync:{' '}
              {formatDate(syncMeta.lastSuccessAt?.toISOString() ?? null)}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="capitalize">{syncMeta.lastRunStatus ?? 'unknown'}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/api/v1/posts?page=1&pageSize=20">API</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="panel-muted h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-[0.14em]">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/posts" method="get" className="grid gap-3">
              <label className="grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/70">
                Sort
                <Select name="sort" defaultValue={sort}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/70">
                Category
                <Select name="category" defaultValue={category ?? ''}>
                  <option value="">All categories</option>
                  {categories.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </label>

              {month ? <input type="hidden" name="month" value={month} /> : null}

              <div className="mt-1 flex gap-2">
                <Button type="submit" size="sm" className="flex-1">
                  Apply
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/posts">Reset</Link>
                </Button>
              </div>
            </form>

            <Separator className="my-4" />

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/70">Archives</p>
              <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                {archives.length === 0 ? (
                  <p className="text-sm text-foreground/70">No archive buckets yet.</p>
                ) : (
                  archives.map((bucket) => {
                    const active = month === bucket.month;
                    return (
                      <Button
                        key={bucket.month}
                        asChild
                        variant={active ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 justify-between px-2 text-[10px]"
                      >
                        <Link href={buildPostsHref({ page: 1, sort, category, month: active ? undefined : bucket.month })}>
                          <span>{bucket.label}</span>
                          <span>{bucket.postCount}</span>
                        </Link>
                      </Button>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
            <span>
              Showing {transformedItems.length} of {postData.total} post{postData.total === 1 ? '' : 's'}
            </span>
            {category ? <Badge variant="outline">Category: {categoryNameBySlug.get(category) ?? category}</Badge> : null}
            {activeArchive ? <Badge variant="outline">Archive: {activeArchive.label}</Badge> : null}
          </div>

          {transformedItems.length === 0 ? (
            <Card className="panel-muted mt-3">
              <CardContent className="pt-5 text-sm text-foreground/70">No posts match your filters.</CardContent>
            </Card>
          ) : (
            <div className="mt-3 grid gap-3">
              {transformedItems.map((item) => (
                <Card key={item.id} className="panel-muted">
                  <CardHeader className="space-y-2 pb-3">
                    <Badge variant="outline" className="w-fit">
                      Published {formatDate(item.publishedAtGmt)}
                    </Badge>
                    <CardTitle className="text-xl sm:text-2xl">
                      <Link href={`/posts/${item.slug}`} className="underline-offset-2 hover:underline">
                        {item.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="article-html text-sm" dangerouslySetInnerHTML={{ __html: item.excerptHtml }} />

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.categories.map((slug) => (
                        <Button key={`c:${item.id}:${slug}`} asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px]">
                          <Link href={buildPostsHref({ sort, category: slug, month, page: 1 })}>
                            {categoryNameBySlug.get(slug) ?? slug}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPostsHref({ sort, category, month, page: page - 1 })}>Previous</Link>
              </Button>
            ) : null}

            <Badge variant="outline" className="h-8 px-3">Page {Math.min(page, totalPages)} of {totalPages}</Badge>

            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPostsHref({ sort, category, month, page: page + 1 })}>Next</Link>
              </Button>
            ) : null}
          </nav>
        </section>
      </section>
    </main>
  );
}
