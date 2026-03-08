import Link from 'next/link';
import { SlidersHorizontalIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ContentCardPreview } from '@/components/content-card-preview';
import { WikiFilterSidebar } from '@/components/wiki-filter-sidebar';
import { toArticleListResponse } from '@/lib/content/transform';
import { listArticles, listCategories, listTags, type ArticleSort } from '@/lib/db/queries';
import { formatContentLabel } from '@/lib/utils/content';
import { formatDate } from '@/lib/utils/date';
import { buildPaginationTokens } from '@/lib/utils/pagination';

export const revalidate = 28800;

const PAGE_SIZE = 8;
const DEFAULT_SORT: ArticleSort = 'modified_desc';
const SORT_OPTIONS: Array<{ value: ArticleSort; label: string }> = [
  { value: 'modified_desc', label: 'Recently updated' },
  { value: 'modified_asc', label: 'Oldest updated' },
  { value: 'published_desc', label: 'Newest published' },
  { value: 'published_asc', label: 'Oldest published' }
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

function parseSort(value: string | undefined): ArticleSort {
  if (!value) {
    return DEFAULT_SORT;
  }

  const found = SORT_OPTIONS.find((option) => option.value === value);
  return found?.value ?? DEFAULT_SORT;
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

  if (options.sort !== DEFAULT_SORT) {
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

export default async function WikiPage({ searchParams }: SearchParamProps) {
  const params = await searchParams;
  const page = parsePositiveInt(getFirstParam(params?.page), 1);
  const sort = parseSort(getFirstParam(params?.sort));
  const category = getFirstParam(params?.category)?.trim() || undefined;
  const tag = getFirstParam(params?.tag)?.trim() || undefined;

  const [articleData, categories, tags] = await Promise.all([
    listArticles({
      page,
      pageSize: PAGE_SIZE,
      sort,
      categorySlug: category,
      tagSlug: tag
    }),
    listCategories(),
    listTags()
  ]);

  const transformedItems = articleData.items.map(toArticleListResponse);
  const totalPages = Math.max(1, Math.ceil(articleData.total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginationTokens = buildPaginationTokens(currentPage, totalPages);

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, formatContentLabel(item.name)]));
  const tagNameBySlug = new Map(tags.map((item) => [item.slug, formatContentLabel(item.name)]));
  const sortLabelByValue = new Map(SORT_OPTIONS.map((option) => [option.value, option.label]));

  const activeFilters = [
    sort !== DEFAULT_SORT
      ? {
          key: 'sort',
          label: `Sort: ${sortLabelByValue.get(sort) ?? sort}`,
          href: buildWikiHref({ sort: DEFAULT_SORT, category, tag, page: 1 })
        }
      : null,
    category
      ? {
          key: 'category',
          label: `Category: ${categoryNameBySlug.get(category) ?? category}`,
          href: buildWikiHref({ sort, category: undefined, tag, page: 1 })
        }
      : null,
    tag
      ? {
          key: 'tag',
          label: `Tag: ${tagNameBySlug.get(tag) ?? tag}`,
          href: buildWikiHref({ sort, category, tag: undefined, page: 1 })
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
                <BreadcrumbPage>Wiki</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Badge variant="outline" className="mb-2">Wiki</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Articles</h1>
          <p className="mt-2 text-sm text-muted-foreground">Refined internal guides and technical documentation.</p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card id="wiki-filters" className="panel-muted order-2 h-fit lg:order-1 lg:sticky lg:top-20">
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

            <Separator className="my-4" />

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
                          {formatContentLabel(item.name)}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <section className="order-1 lg:order-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Showing {transformedItems.length} of {articleData.total} article{articleData.total === 1 ? '' : 's'}
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
                    <Link href="/wiki">Clear all</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            <Button asChild variant="outline" size="sm" className="w-fit lg:hidden">
              <a href="#wiki-filters">
                <SlidersHorizontalIcon className="mr-2 h-4 w-4" />
                Refine results
              </a>
            </Button>
          </div>

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
                    <div className="space-y-3">
                      <p className="text-sm leading-7 text-foreground/78">{item.summary}</p>
                      <Link href={`/wiki/${item.slug}`} className={CONTINUE_READING_CLASS}>
                        Continue reading {'->'}
                      </Link>
                    </div>

                    <ContentCardPreview href={`/wiki/${item.slug}`} previews={item.mediaPreviews} />

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
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={buildWikiHref({ sort, category, tag, page: currentPage - 1 })} />
                </PaginationItem>
              )}
              {paginationTokens.map((token, index) => (
                <PaginationItem key={`${token}-${index}`}>
                  {token === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href={buildWikiHref({ sort, category, tag, page: token })}
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
                  <PaginationNext href={buildWikiHref({ sort, category, tag, page: currentPage + 1 })} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </section>
      </section>
    </main>
  );
}

