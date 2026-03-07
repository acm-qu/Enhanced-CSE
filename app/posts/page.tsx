import Link from 'next/link';
import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContentCardPreview } from '@/components/content-card-preview';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PostsFilterSidebar } from '@/components/posts-filter-sidebar';
import { toPostListResponse } from '@/lib/content/transform';
import { listPostArchives, listPostCategories, listPosts, type PostSort } from '@/lib/db/posts-queries';
import { formatContentLabel } from '@/lib/utils/content';
import { formatDate } from '@/lib/utils/date';
import { buildPaginationTokens } from '@/lib/utils/pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;
const DEFAULT_SORT: PostSort = 'published_desc';
const SORT_OPTIONS: Array<{ value: PostSort; label: string }> = [
  { value: 'published_desc', label: 'Newest published' },
  { value: 'published_asc', label: 'Oldest published' },
  { value: 'modified_desc', label: 'Recently updated' },
  { value: 'modified_asc', label: 'Oldest updated' }
];
const CONTINUE_READING_CLASS =
  'inline-flex items-center gap-2 text-sm font-semibold text-[#2CAD9E] transition-colors hover:text-[#3AE4D1]';

interface SearchParamProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
    return DEFAULT_SORT;
  }

  const found = SORT_OPTIONS.find((option) => option.value === value);
  return found?.value ?? DEFAULT_SORT;
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

  if (options.sort !== DEFAULT_SORT) {
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

export default async function PostsPage({ searchParams }: SearchParamProps) {
  const params = await searchParams;
  const page = parsePositiveInt(getFirstParam(params?.page), 1);
  const sort = parseSort(getFirstParam(params?.sort));
  const category = getFirstParam(params?.category)?.trim() || undefined;
  const month = parseMonth(getFirstParam(params?.month));

  const monthRange = month ? monthToRange(month) : undefined;

  const [postData, categories, archives] = await Promise.all([
    listPosts({
      page,
      pageSize: PAGE_SIZE,
      categorySlug: category,
      after: monthRange?.after,
      before: monthRange?.before,
      sort
    }),
    listPostCategories(),
    listPostArchives({ categorySlug: category })
  ]);

  const transformedItems = postData.items.map(toPostListResponse);
  const totalPages = Math.max(1, Math.ceil(postData.total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginationTokens = buildPaginationTokens(currentPage, totalPages);
  const recentArchives = archives.slice(0, 6);
  const overflowArchives = archives.slice(6);

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, formatContentLabel(item.name)]));
  const activeArchive = archives.find((bucket) => bucket.month === month) ?? null;
  const sortLabelByValue = new Map(SORT_OPTIONS.map((option) => [option.value, option.label]));

  const activeFilters = [
    sort !== DEFAULT_SORT
      ? {
          key: 'sort',
          label: `Sort: ${sortLabelByValue.get(sort) ?? sort}`,
          href: buildPostsHref({ sort: DEFAULT_SORT, category, month, page: 1 })
        }
      : null,
    category
      ? {
          key: 'category',
          label: `Category: ${categoryNameBySlug.get(category) ?? category}`,
          href: buildPostsHref({ sort, category: undefined, month, page: 1 })
        }
      : null,
    activeArchive
      ? {
          key: 'month',
          label: `Archive: ${activeArchive.label}`,
          href: buildPostsHref({ sort, category, month: undefined, page: 1 })
        }
      : null
  ].filter((item): item is { key: string; label: string; href: string } => Boolean(item));

  return (
    <main className="content-shell content-shell-tight">
      <section className="panel px-5 py-6 sm:px-6">
        <div>
          <Breadcrumb className="mb-3">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Blog</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Badge variant="outline" className="mb-2">Blog</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Articles</h1>
          <p className="mt-2 text-sm text-muted-foreground">Main-site posts with category and archive navigation.</p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card id="posts-filters" className="panel-muted order-2 h-fit lg:order-1 lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-[0.14em]">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <PostsFilterSidebar
              categories={categories}
              sortOptions={SORT_OPTIONS}
              currentSort={sort}
              currentCategory={category}
              currentMonth={month}
            />

            <Separator className="my-4" />

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Recent archives</p>
              <div className="mt-2 flex flex-col gap-1">
                {recentArchives.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No archive buckets yet.</p>
                ) : (
                  recentArchives.map((bucket) => {
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

              {overflowArchives.length > 0 ? (
                <Collapsible className="mt-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-[11px] text-muted-foreground">
                      More archives
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="mt-2 h-56">
                      <div className="flex flex-col gap-1 pr-3">
                        {overflowArchives.map((bucket) => {
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
                        })}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <section className="order-1 lg:order-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Showing {transformedItems.length} of {postData.total} post{postData.total === 1 ? '' : 's'}
              </p>

              {activeFilters.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <Button key={filter.key} asChild variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs">
                      <Link href={filter.href}>
                        {filter.label}
                        <XIcon className="ml-1.5 h-3 w-3" />
                      </Link>
                    </Button>
                  ))}
                  <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground">
                    <Link href="/posts">Clear all</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            <Button asChild variant="outline" size="sm" className="w-fit lg:hidden">
              <a href="#posts-filters">
                <SlidersHorizontalIcon className="mr-2 h-4 w-4" />
                Refine results
              </a>
            </Button>
          </div>

          {transformedItems.length === 0 ? (
            <Card className="panel-muted mt-3">
              <CardContent className="pt-5 text-sm text-muted-foreground">No posts match your filters.</CardContent>
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
                    <div className="space-y-3">
                      <p className="text-sm leading-7 text-foreground/78">{item.summary}</p>
                      <Link href={`/posts/${item.slug}`} className={CONTINUE_READING_CLASS}>
                        Continue reading {'->'}
                      </Link>
                    </div>

                    <ContentCardPreview href={`/posts/${item.slug}`} previews={item.mediaPreviews} />

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

          <Pagination className="mt-5">
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={buildPostsHref({ sort, category, month, page: currentPage - 1 })} />
                </PaginationItem>
              )}
              {paginationTokens.map((token, index) => (
                <PaginationItem key={`${token}-${index}`}>
                  {token === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href={buildPostsHref({ sort, category, month, page: token })}
                      isActive={token === currentPage}
                      size="default"
                      className="min-w-9 px-3"
                    >
                      {token}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext href={buildPostsHref({ sort, category, month, page: currentPage + 1 })} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </section>
      </section>
    </main>
  );
}

