import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ChevronDownIcon } from 'lucide-react';
import { TocNav } from '@/components/toc-nav';
import { toArticleDetailResponse } from '@/lib/content/transform';
import { getArticleBySlug, listCategories, listTags } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

interface DetailPageProps {
  params: {
    slug: string;
  };
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return stripTags(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function addHeadingIdsAndBuildToc(html: string): { html: string; toc: TocItem[] } {
  const used = new Map<string, number>();
  const toc: TocItem[] = [];

  const htmlWithAnchors = html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, levelRaw, attrsRaw, innerHtml) => {
    const level = Number(levelRaw);
    const text = stripTags(innerHtml);
    if (!text) {
      return _match;
    }

    const existingIdMatch = String(attrsRaw).match(/\sid=(['"])(.*?)\1/i);
    let headingId = existingIdMatch?.[2] ?? '';

    if (!headingId) {
      const base = slugify(text) || 'section';
      const seen = used.get(base) ?? 0;
      headingId = seen === 0 ? base : `${base}-${seen + 1}`;
      used.set(base, seen + 1);
    }

    toc.push({ id: headingId, text, level });

    if (existingIdMatch) {
      return `<h${level}${attrsRaw}>${innerHtml}</h${level}>`;
    }

    return `<h${level}${attrsRaw} id="${headingId}">${innerHtml}</h${level}>`;
  });

  return { html: htmlWithAnchors, toc };
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
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);

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
  const [article, categories, tags] = await Promise.all([getArticleBySlug(params.slug), listCategories(), listTags()]);

  if (!article) {
    notFound();
  }

  const transformed = toArticleDetailResponse(article);
  const { html, toc } = addHeadingIdsAndBuildToc(transformed.contentHtml);

  const categoryNameBySlug = new Map(categories.map((item) => [item.slug, item.name]));
  const tagNameBySlug = new Map(tags.map((item) => [item.slug, item.name]));

  return (
    <main className="content-shell">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
        <aside className="hidden xl:block">
          <Card className="panel-muted sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-[0.14em]">Article Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground/72">
              <p>Published: {formatDate(transformed.publishedAtGmt)}</p>
              <p>Updated: {formatDate(transformed.modifiedAtGmt)}</p>
              <Separator />
              <Button asChild variant="outline" size="sm">
                <Link href="/wiki">Back to index</Link>
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
                    <BreadcrumbPage>{transformed.slug}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <CardTitle className="text-3xl sm:text-5xl">{transformed.title}</CardTitle>

              <CardDescription className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.11em] text-foreground/60">
                <span>Published {formatDate(transformed.publishedAtGmt)}</span>
                <span>Updated {formatDate(transformed.modifiedAtGmt)}</span>
              </CardDescription>

              <div className="flex flex-wrap gap-2">
                {transformed.categories.map((slug) => (
                  <Badge key={`c:${slug}`} variant="outline">
                    <Link href={`/wiki?category=${encodeURIComponent(slug)}`}>{categoryNameBySlug.get(slug) ?? slug}</Link>
                  </Badge>
                ))}
                {transformed.tags.map((slug) => (
                  <Badge key={`t:${slug}`} variant="outline">
                    <Link href={`/wiki?tag=${encodeURIComponent(slug)}`}>#{tagNameBySlug.get(slug) ?? slug}</Link>
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
          <div className="no-scrollbar sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
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
