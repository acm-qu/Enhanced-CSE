import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchIcon } from 'lucide-react';
import { toArticleListResponse, toPostListResponse } from '@/lib/content/transform';
import { listPosts } from '@/lib/db/posts-queries';
import { getSyncMeta, listArticles, listCategories, type TermWithCount } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const FEATURED_CATEGORY_RULES = [
  {
    label: 'Student Services & Policies',
    keywords: ['offering', 'service']
  },
  {
    label: 'CSE Focal Point Team',
    keywords: ['focal', 'advisor', 'coordinator']
  },
  {
    label: 'Senior Projects',
    keywords: ['senior', 'project']
  }
] as const;

function formatDate(iso: string | null): string {
  if (!iso) {
    return 'Never';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pickFeaturedCategories(categories: TermWithCount[]): Array<{
  slug: string;
  sourceName: string;
  displayName: string;
  articleCount: number;
}> {
  const selected: Array<{
    slug: string;
    sourceName: string;
    displayName: string;
    articleCount: number;
  }> = [];

  const usedSlugs = new Set<string>();
  const sortedByCount = [...categories].sort((a, b) => b.articleCount - a.articleCount);

  for (const rule of FEATURED_CATEGORY_RULES) {
    const match = sortedByCount.find((category) => {
      if (usedSlugs.has(category.slug)) {
        return false;
      }

      const haystack = `${normalizeText(category.name)} ${normalizeText(category.slug)}`;
      return rule.keywords.some((keyword) => haystack.includes(keyword));
    });

    if (!match) {
      continue;
    }

    usedSlugs.add(match.slug);
    selected.push({
      slug: match.slug,
      sourceName: match.name,
      displayName: rule.label,
      articleCount: match.articleCount
    });
  }

  for (const category of sortedByCount) {
    if (selected.length >= 3) {
      break;
    }

    if (usedSlugs.has(category.slug)) {
      continue;
    }

    usedSlugs.add(category.slug);
    selected.push({
      slug: category.slug,
      sourceName: category.name,
      displayName: category.name,
      articleCount: category.articleCount
    });
  }

  return selected.slice(0, 3);
}

export default async function HomePage() {
  const [meta, categories, latestPosts, latestWiki] = await Promise.all([
    getSyncMeta(),
    listCategories(),
    listPosts({
      page: 1,
      pageSize: 6,
      sort: 'published_desc'
    }),
    listArticles({
      page: 1,
      pageSize: 8,
      sort: 'modified_desc'
    })
  ]);

  const featuredCategories = pickFeaturedCategories(categories);
  const featuredSections = await Promise.all(
    featuredCategories.map(async (category) => {
      const articleData = await listArticles({
        page: 1,
        pageSize: 5,
        categorySlug: category.slug,
        sort: 'modified_desc'
      });

      return {
        ...category,
        items: articleData.items.map(toArticleListResponse)
      };
    })
  );

  const recentPosts = latestPosts.items.map(toPostListResponse);
  const recentWiki = latestWiki.items.map(toArticleListResponse);

  const SECTION_ACCENTS = [
    { gradient: 'from-blue-500 to-cyan-400', glow: 'bg-blue-500/20' },
    { gradient: 'from-violet-500 to-pink-500', glow: 'bg-violet-500/20' },
    { gradient: 'from-orange-500 to-amber-400', glow: 'bg-orange-500/20' },
  ] as const;

  return (
    <main className="content-shell">
      {/* ── HERO ── */}
      <section className="panel relative overflow-hidden px-5 py-8 text-center sm:px-10 sm:py-10">
        {/* Decorative gradient blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-0 h-[260px] w-[260px] rounded-full bg-violet-500/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-[220px] w-[220px] rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10">
          <div className="mx-auto mb-4 flex max-w-[200px] justify-center">
            <Image
              src="/QU Logo - Stacked Black.png"
              alt="Qatar University College of Engineering logo"
              width={480}
              height={150}
              className="h-auto w-full dark:hidden"
              priority
            />
            <Image
              src="/QU Logo - Stacked White.png"
              alt="Qatar University College of Engineering logo"
              width={480}
              height={150}
              className="hidden h-auto w-full dark:block"
              priority
            />
          </div>

          <h1 className="mx-auto max-w-3xl text-2xl font-semibold tracking-tight sm:text-4xl">
            Computer Science and Engineering Wiki
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Access departmental services, guidelines, advisement resources, and senior project archives in one place.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-500">
              <Link href="/wiki">Browse Wiki</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/posts">Browse Articles</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/wiki?sort=modified_desc">Latest Updates</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── FEATURED SECTIONS ── */}
      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        {featuredSections.map((section, index) => {
          const accent = SECTION_ACCENTS[index % SECTION_ACCENTS.length];
          return (
          <Card key={section.slug} className="panel-muted">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Gradient circle accent */}
                  <div className={`relative h-5 w-5 shrink-0 rounded-full bg-gradient-to-br ${accent.gradient}`}>
                    <div aria-hidden="true" className={`absolute inset-0 rounded-full ${accent.glow} blur-md`} />
                  </div>
                  <CardTitle className="text-base font-semibold">{section.displayName}</CardTitle>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <Link href={`/wiki?category=${encodeURIComponent(section.slug)}`} aria-label={`Open ${section.displayName}`}>
                          <SearchIcon className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{section.displayName}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Separator />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No links synced for this section yet.</p>
                ) : (
                  section.items.map((article) => (
                    <p key={article.id} className="text-[13px] leading-snug">
                      <Link href={`/wiki/${article.slug}`} className="text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline">
                        {article.title}
                      </Link>
                    </p>
                  ))
                )}
              </div>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href={`/wiki?category=${encodeURIComponent(section.slug)}`}>
                    Show all {section.articleCount} in {section.sourceName}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.3fr,1fr]">
        <Card className="panel-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-blue-600">
                  <div aria-hidden="true" className="absolute inset-0 rounded-full bg-sky-500/20 blur-md" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Recent Wiki Updates</CardTitle>
                  <CardDescription className="text-xs">Most recently modified pages.</CardDescription>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/wiki">All Wiki Pages</Link>
              </Button>
            </div>
            <Separator />
          </CardHeader>
          <CardContent className="space-y-2">
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-1.5">
                {recentWiki.map((article) => (
                  <p key={article.id} className="text-[13px] leading-snug">
                    <Link href={`/wiki/${article.slug}`} className="text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline">
                      {article.title}
                    </Link>
                  </p>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="panel-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400">
                <div aria-hidden="true" className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold capitalize">{meta.lastRunStatus ?? 'unknown'}</CardTitle>
                  <Badge variant={meta.lastRunStatus !== 'success' ? 'destructive' : 'default'} className="h-5 px-1.5 text-[10px]">Sync</Badge>
                </div>
                <CardDescription className="text-xs">Last sync: {formatDate(meta.lastSuccessAt?.toISOString() ?? null)}</CardDescription>
              </div>
            </div>
            <Separator />
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts available yet.</p>
            ) : (
              recentPosts.map((post) => (
                <p key={post.id} className="text-[13px] leading-snug">
                  <Link href={`/posts/${post.slug}`} className="text-blue-500 underline-offset-2 transition-colors hover:text-blue-400 hover:underline">
                    {post.title}
                  </Link>
                </p>
              ))
            )}
            <div className="pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/posts">Open Posts Archive</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
