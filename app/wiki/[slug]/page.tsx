import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticleBody } from '@/components/article-body';
import { RelatedContentSection } from '@/components/related-content-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TocDropdown } from '@/components/toc-dropdown';
import { TocNav } from '@/components/toc-nav';
import { toArticleDetailResponse, toArticleListResponse } from '@/lib/content/transform';
import { getArticleBySlug, listAllArticleSlugs, listArticles } from '@/lib/db/queries';
import { getCachedCategories, getCachedTags } from '@/lib/db/cached-queries';
import { addHeadingIdsAndBuildToc, formatContentLabel } from '@/lib/utils/content';
import { formatDate } from '@/lib/utils/date';

export const revalidate = 28800;
export const dynamicParams = true;

const getCachedArticle = cache(getArticleBySlug);

export async function generateStaticParams() {
  const slugs = await listAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface DetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getCachedArticle(slug);

  if (!article) {
    return {
      title: 'Article Not Found'
    };
  }

  const transformed = toArticleDetailResponse(article);

  return {
    title: transformed.title,
    description: `Synced wiki article: ${transformed.title}`
  };
}

export default async function WikiDetailPage({ params }: DetailPageProps) {
  const { slug } = await params;
  const [article, categories, tags] = await Promise.all([getCachedArticle(slug), getCachedCategories(), getCachedTags()]);

  if (!article) {
    notFound();
  }

  const transformed = toArticleDetailResponse(article);
  const { html, toc } = addHeadingIdsAndBuildToc(transformed.contentHtml);
  const hasToc = toc.length > 0;

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, formatContentLabel(item.name)]));
  const tagNameBySlug = new Map(tags.map((item) => [item.slug, formatContentLabel(item.name)]));
  const primaryCategory = transformed.categories[0];

  const relatedArticles = primaryCategory
    ? (await listArticles({
        page: 1,
        pageSize: 6,
        categorySlug: primaryCategory,
        sort: 'modified_desc'
      })).items
        .filter((item) => item.slug !== transformed.slug)
        .slice(0, 3)
        .map(toArticleListResponse)
    : [];

  const layoutClass = hasToc
    ? 'grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]'
    : 'grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]';

  // Every archive opens with an h1 repeating the article title; listing it as
  // the first destination would be a link back to where the reader already is.
  const jumpItems =
    toc[0]?.level === 1 && toc[0].text.trim() === transformed.title.trim() ? toc.slice(1) : toc;

  // The senior-project archives file under this category and run to 60+ entries,
  // where every h2 is one project — worth naming as such rather than "sections".
  const isProjectArchive = transformed.categories.includes('previous-senior-project');

  return (
    <main className="content-shell">
      <div className={layoutClass}>
        <aside className="hidden xl:block">
          <Card className="panel-muted sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-[0.14em]">Article Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground/72">
              <p>Published: {formatDate(transformed.publishedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</p>
              <p>Updated: {formatDate(transformed.modifiedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</p>
              <Separator />
              <Button asChild variant="outline" size="sm">
                <Link href="/wiki">Back to wiki</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>

        <article>
          <Card className="panel">
            <CardHeader className="space-y-4 pb-5">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/wiki">Wiki</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{transformed.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit px-2 text-muted-foreground xl:hidden">
                <Link href="/wiki">Back to wiki</Link>
              </Button>

              <CardTitle className="text-3xl sm:text-5xl">{transformed.title}</CardTitle>

              <CardDescription className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.11em] text-foreground/60">
                <span>Published {formatDate(transformed.publishedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</span>
                <span>Updated {formatDate(transformed.modifiedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</span>
              </CardDescription>

              <div className="flex flex-wrap gap-2">
                {transformed.categories.map((categorySlug) => (
                  <Badge key={`c:${categorySlug}`} variant="outline">
                    <Link href={`/wiki?category=${encodeURIComponent(categorySlug)}`}>
                      {categoryNameBySlug.get(categorySlug) ?? categorySlug}
                    </Link>
                  </Badge>
                ))}
                {transformed.tags.map((tagSlug) => (
                  <Badge key={`t:${tagSlug}`} variant="outline">
                    <Link href={`/wiki?tag=${encodeURIComponent(tagSlug)}`}>
                      #{tagNameBySlug.get(tagSlug) ?? tagSlug}
                    </Link>
                  </Badge>
                ))}
              </div>

              {/* Stands in for the TOC sidebar, which is hidden below xl. */}
              {jumpItems.length > 0 ? (
                <TocDropdown
                  items={jumpItems}
                  eyebrow={isProjectArchive ? 'Jump to project' : 'On this page'}
                  noun={isProjectArchive ? 'project' : 'section'}
                  className="xl:hidden"
                />
              ) : null}
            </CardHeader>

            <CardContent>
              <ArticleBody html={html} />
            </CardContent>
          </Card>
        </article>

        {hasToc ? (
          <aside className="hidden xl:block">
            <div className="no-scrollbar sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-4 pb-10">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                On This Page
              </p>
              <TocNav items={toc} />
            </div>
          </aside>
        ) : null}
      </div>

      <RelatedContentSection
        eyebrow={primaryCategory ? `More in ${categoryNameBySlug.get(primaryCategory) ?? primaryCategory}` : 'Related articles'}
        title="Keep browsing the wiki"
        items={relatedArticles.map((item) => ({
          href: `/wiki/${item.slug}`,
          title: item.title,
          summary: item.summary,
          dateLabel: `Updated ${formatDate(item.modifiedAtGmt)}`
        }))}
        viewAllHref={primaryCategory ? `/wiki?category=${encodeURIComponent(primaryCategory)}` : '/wiki'}
        viewAllLabel={primaryCategory ? 'Browse category' : 'Browse all articles'}
      />
    </main>
  );
}
