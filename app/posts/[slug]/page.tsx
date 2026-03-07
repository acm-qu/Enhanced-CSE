import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronDownIcon } from 'lucide-react';

import { ArticleBody } from '@/components/article-body';
import { RelatedContentSection } from '@/components/related-content-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { TocNav } from '@/components/toc-nav';
import { toPostDetailResponse, toPostListResponse } from '@/lib/content/transform';
import { getPostBySlug, listPostCategories, listPosts } from '@/lib/db/posts-queries';
import { addHeadingIdsAndBuildToc, formatContentLabel } from '@/lib/utils/content';
import { formatDate } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

interface DetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found'
    };
  }

  const transformed = toPostDetailResponse(post);

  return {
    title: transformed.title,
    description: `Synced post: ${transformed.title}`
  };
}

export default async function PostDetailPage({ params }: DetailPageProps) {
  const { slug } = await params;
  const [post, categories] = await Promise.all([getPostBySlug(slug), listPostCategories()]);

  if (!post) {
    notFound();
  }

  const transformed = toPostDetailResponse(post);
  const { html, toc } = addHeadingIdsAndBuildToc(transformed.contentHtml);
  const hasToc = toc.length > 0;

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, formatContentLabel(item.name)]));
  const primaryCategory = transformed.categories[0];

  const relatedPosts = primaryCategory
    ? (await listPosts({
        page: 1,
        pageSize: 6,
        categorySlug: primaryCategory,
        sort: 'published_desc'
      })).items
        .filter((item) => item.slug !== transformed.slug)
        .slice(0, 3)
        .map(toPostListResponse)
    : [];

  const layoutClass = hasToc
    ? 'grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]'
    : 'grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]';

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
                <Link href="/posts">Back to posts</Link>
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
                    <BreadcrumbLink href="/posts">Posts</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{transformed.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit px-2 text-muted-foreground xl:hidden">
                <Link href="/posts">Back to posts</Link>
              </Button>

              <CardTitle className="text-3xl sm:text-5xl">{transformed.title}</CardTitle>

              <CardDescription className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.11em] text-foreground/60">
                <span>Published {formatDate(transformed.publishedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</span>
                <span>Updated {formatDate(transformed.modifiedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</span>
              </CardDescription>

              <div className="flex flex-wrap gap-2">
                {transformed.categories.map((categorySlug) => (
                  <Badge key={`c:${categorySlug}`} variant="outline">
                    <Link href={`/posts?category=${encodeURIComponent(categorySlug)}`}>
                      {categoryNameBySlug.get(categorySlug) ?? categorySlug}
                    </Link>
                  </Badge>
                ))}
              </div>
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

      {hasToc ? (
        <div className="mt-4 space-y-3 xl:hidden">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                On This Page <ChevronDownIcon className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <nav className="mt-2 space-y-1 pl-2">
                {toc.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="block text-sm hover:underline">
                    {item.text}
                  </a>
                ))}
              </nav>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : null}

      <RelatedContentSection
        eyebrow={primaryCategory ? `More in ${categoryNameBySlug.get(primaryCategory) ?? primaryCategory}` : 'Related posts'}
        title="Keep reading"
        items={relatedPosts.map((item) => ({
          href: `/posts/${item.slug}`,
          title: item.title,
          summary: item.summary,
          dateLabel: `Published ${formatDate(item.publishedAtGmt)}`
        }))}
        viewAllHref={primaryCategory ? `/posts?category=${encodeURIComponent(primaryCategory)}` : '/posts'}
        viewAllLabel={primaryCategory ? 'Browse category' : 'Browse all posts'}
      />
    </main>
  );
}
