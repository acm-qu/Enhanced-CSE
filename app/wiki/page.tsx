import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WikiFilterSidebar } from '@/components/wiki-filter-sidebar';
import { toArticleListResponse } from '@/lib/content/transform';
import { getSyncMeta, listArticles, listCategories, listTags, type ArticleSort } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 8;
const SORT_OPTIONS: Array<{ value: ArticleSort; label: string }> = [
  { value: 'modified_desc', label: 'Recently updated' },
  { value: 'modified_asc', label: 'Oldest updated' },
  { value: 'published_desc', label: 'Newest published' },
  { value: 'published_asc', label: 'Oldest published' }
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

function parseSort(value: string | undefined): ArticleSort {
  if (!value) {
    return 'modified_desc';
  }

  const found = SORT_OPTIONS.find((option) => option.value === value);
  return found?.value ?? 'modified_desc';
}

function buildWikiHref(options: {
  page?: number;
  sort: ArticleSort;
  category?: string;
  tag?: string;
}): string {
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set('page', String(options.page));
  }

  if (options.sort !== 'modified_desc') {
    params.set('sort', options.sort);
  }

  if (options.category) {
    params.set('category', options.category);
  }

  if (options.tag) {
    params.set('tag', options.tag);
  }

  const query = params.toString();
  return query ? `/wiki?${query}` : '/wiki';
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

export default async function WikiPage({ searchParams }: SearchParamProps) {
  const page = parsePositiveInt(getFirstParam(searchParams?.page), 1);
  const sort = parseSort(getFirstParam(searchParams?.sort));
  const category = getFirstParam(searchParams?.category)?.trim() || undefined;
  const tag = getFirstParam(searchParams?.tag)?.trim() || undefined;

  const [articleData, categories, tags, syncMeta] = await Promise.all([
    listArticles({
      page,
      pageSize: PAGE_SIZE,
      sort,
      categorySlug: category,
      tagSlug: tag
    }),
    listCategories(),
    listTags(),
    getSyncMeta()
  ]);

  const transformedItems = articleData.items.map(toArticleListResponse);
  const totalPages = Math.max(1, Math.ceil(articleData.total / PAGE_SIZE));

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, item.name]));
  const tagNameBySlug = new Map(tags.map((item) => [item.slug, item.name]));

  return (
    <main className="content-shell">
      <section className="panel px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Breadcrumb className="mb-3">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Wiki</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Badge variant="outline" className="mb-2">Wiki</Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Articles</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Refined internal guides and technical documentation. Last sync:{' '}
              {formatDate(syncMeta.lastSuccessAt?.toISOString() ?? null)}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="capitalize">{syncMeta.lastRunStatus ?? 'unknown'}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/api/v1/wiki/articles?page=1&pageSize=20">API</Link>
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
            <WikiFilterSidebar
              categories={categories}
              tags={tags}
              sortOptions={SORT_OPTIONS}
              currentSort={sort}
              currentCategory={category}
              currentTag={tag}
            />

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Categories</p>
              <ScrollArea className="h-64">
                <div className="mt-2 flex flex-wrap gap-1 pr-3">
                  {categories.map((item) => {
                    const active = category === item.slug;
                    return (
                      <Button
                        key={item.slug}
                        asChild
                        variant={active ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                      >
                        <Link href={buildWikiHref({ sort, category: active ? undefined : item.slug, tag, page: 1 })}>
                          {item.name}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <section>
          <p className="text-sm text-muted-foreground">
            Showing {transformedItems.length} of {articleData.total} article{articleData.total === 1 ? '' : 's'}
          </p>

          {transformedItems.length === 0 ? (
            <Card className="panel-muted mt-3">
              <CardContent className="pt-5 text-sm text-muted-foreground">No articles match your filters.</CardContent>
            </Card>
          ) : (
            <div className="mt-3 grid gap-3">
              {transformedItems.map((item) => (
                <Card key={item.id} className="panel-muted">
                  <CardHeader className="space-y-2 pb-3">
                    <Badge variant="outline" className="w-fit">
                      Updated {formatDate(item.modifiedAtGmt)}
                    </Badge>
                    <CardTitle className="text-xl sm:text-2xl">
                      <Link href={`/wiki/${item.slug}`} className="underline-offset-2 hover:underline">
                        {item.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="article-html text-sm" dangerouslySetInnerHTML={{ __html: item.excerptHtml }} />

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.categories.map((slug) => (
                        <Button key={`c:${item.id}:${slug}`} asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px]">
                          <Link href={buildWikiHref({ sort, category: slug, tag, page: 1 })}>
                            {categoryNameBySlug.get(slug) ?? slug}
                          </Link>
                        </Button>
                      ))}
                      {item.tags.map((slug) => (
                        <Button key={`t:${item.id}:${slug}`} asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px]">
                          <Link href={buildWikiHref({ sort, category, tag: slug, page: 1 })}>
                            #{tagNameBySlug.get(slug) ?? slug}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Pagination className="mt-5">
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={buildWikiHref({ sort, category, tag, page: page - 1 })} />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink isActive>{Math.min(page, totalPages)}</PaginationLink>
              </PaginationItem>
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext href={buildWikiHref({ sort, category, tag, page: page + 1 })} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </section>
      </section>
    </main>
  );
}
