import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ChevronDownIcon } from 'lucide-react';
import { TocNav } from '@/components/toc-nav';
import { toPostDetailResponse } from '@/lib/content/transform';
import { getPostBySlug, listPostCategories } from '@/lib/db/posts-queries';
import { addHeadingIdsAndBuildToc, type TocItem } from '@/lib/utils/content';
import { formatDate } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

interface DetailPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);

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
  const [post, categories] = await Promise.all([getPostBySlug(params.slug), listPostCategories()]);

  if (!post) {
    notFound();
  }

  const transformed = toPostDetailResponse(post);
  const { html, toc } = addHeadingIdsAndBuildToc(transformed.contentHtml);

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, item.name]));

  return (
    <main className="content-shell">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
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
                    <BreadcrumbPage>{transformed.slug}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <CardTitle className="text-3xl sm:text-5xl">{transformed.title}</CardTitle>

              <CardDescription className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.11em] text-foreground/60">
                <span>Published {formatDate(transformed.publishedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</span>
                <span>Updated {formatDate(transformed.modifiedAtGmt, { dateStyle: 'long', timeStyle: 'short' })}</span>
              </CardDescription>

              <div className="flex flex-wrap gap-2">
                {transformed.categories.map((slug) => (
                  <Badge key={`c:${slug}`} variant="outline">
                    <Link href={`/posts?category=${encodeURIComponent(slug)}`}>{categoryNameBySlug.get(slug) ?? slug}</Link>
                  </Badge>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              <div className="article-html" dangerouslySetInnerHTML={{ __html: html }} />
            </CardContent>
          </Card>
        </article>

        <aside className="hidden xl:block">
          <div className="no-scrollbar sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-4 pb-10">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
              On This Page
            </p>
            {toc.length === 0 ? (
              <p className="text-[13px] text-muted-foreground/40">No headings available.</p>
            ) : (
              <TocNav items={toc} />
            )}
          </div>
        </aside>
      </div>

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
    </main>
  );
}
