import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CalendarClock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toArticleListResponse, toPostListResponse } from '@/lib/content/transform';
import { listPosts } from '@/lib/db/posts-queries';
import { getSyncMeta, listArticles, listCategories, type TermWithCount } from '@/lib/db/queries';
import { formatDate } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

const SECTION_DOT_CLASSES = ['bg-[#3AE4D1]', 'bg-[#2CAD9E]', 'bg-[#373637]'] as const;

const FEATURED_CATEGORY_RULES = [
  {
    label: 'Student Services',
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

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function pickFeaturedCategories(categories: TermWithCount[]): Array<{
  slug: string;
  displayName: string;
  articleCount: number;
}> {
  const selected: Array<{
    slug: string;
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
        pageSize: 3,
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

  return (
    <main className="w-full">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#04060c] text-white">
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(58,228,209,0.08),transparent_55%)]" />

        <div className="content-shell relative py-14 sm:py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-md border border-white/15 px-3 py-1 text-xs font-semibold tracking-[0.03em] text-white/85">
                Qatar University - College of Engineering
              </p>
              <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
                Computer Science and Engineering Portal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
                Access departmental services, policies, advisement resources, and senior project archives in one
                unified platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-11 min-w-[170px] rounded-md border border-white/15 bg-[#111217] text-white hover:bg-[#1b1d24]"
                >
                  <Link href="/wiki">Browse Wiki</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="h-11 min-w-[170px] rounded-md bg-[#2CAD9E] text-white hover:bg-[#26998d]"
                >
                  <Link href="/posts">Browse Articles</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 min-w-[170px] rounded-md border-[#2CAD9E]/60 bg-transparent text-white hover:bg-[#2CAD9E]/15 hover:text-white"
                >
                  <Link href="/wiki?sort=modified_desc">Latest Updates</Link>
                </Button>
              </div>

              <p className="mt-8 text-sm text-white/70">
                Last successful sync:{' '}
                <span className="font-semibold text-white">{formatDate(meta.lastSuccessAt?.toISOString() ?? null)}</span>
              </p>
            </div>

            <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-[#2CAD9E]/25 bg-black p-6 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
              <Image
                src="/about-us-logo.png"
                alt="ACM Qatar University logo"
                width={460}
                height={460}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>
        </div>

        <div className="absolute right-6 bottom-6 hidden lg:block">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-white/20 bg-black/50 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/api/v1/wiki/categories">All Categories</Link>
          </Button>
        </div>
      </section>

      <section className="content-shell pb-4 pt-4">
        <p className="section-kicker">Highlights</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {featuredSections.map((section, index) => {
            const leadItem = section.items[0] ?? null;
            const summary = leadItem ? trimText(toPlainText(leadItem.excerptHtml), 155) : 'No article summary available yet.';
            const dotClass = SECTION_DOT_CLASSES[index % SECTION_DOT_CLASSES.length];

            return (
              <Card key={section.slug} className="home-panel h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-2xl font-semibold tracking-tight brand-accent">
                    <span className={`home-section-dot ${dotClass}`} />
                    {section.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-base leading-relaxed text-foreground/80">{summary}</p>
                  <Button asChild variant="link" className="h-auto p-0 text-sm brand-accent">
                    <Link href={`/wiki?category=${encodeURIComponent(section.slug)}`}>
                      Browse {section.articleCount} articles <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="content-shell pt-2">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="home-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <span className="home-section-dot bg-[#3AE4D1]" />
                Recent Blog Posts
              </CardTitle>
              <CardDescription>Latest announcements and departmental news.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentPosts.slice(0, 4).map((post, index) => (
                <div key={post.id}>
                  <Link
                    href={`/posts/${post.slug}`}
                    className="group home-list-item"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-[#2CAD9E]">{post.title}</h3>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#2CAD9E]" />
                    </div>
                    <p className="mt-2 text-sm text-foreground/75">Published {formatDate(post.publishedAtGmt)}</p>
                  </Link>
                  {index < 3 ? <Separator className="mt-4 bg-foreground/12" /> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="home-panel">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <span className="home-section-dot bg-[#2CAD9E]" />
                <CalendarClock className="h-5 w-5 brand-accent" />
                Recent Wiki Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentWiki.slice(0, 4).map((article, index) => (
                <div key={article.id}>
                  <Link
                    href={`/wiki/${article.slug}`}
                    className="group home-list-item"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-[#2CAD9E]">{article.title}</h3>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#2CAD9E]" />
                    </div>
                    <p className="mt-2 text-sm text-foreground/75">Updated {formatDate(article.modifiedAtGmt)}</p>
                  </Link>
                  {index < 3 ? <Separator className="mt-4 bg-foreground/12" /> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
